// One-off import of the 2026 "People & Attendance" Google Sheet export
// (Homes, People, PSEC, JYSEP CSVs) into the new database. Run once via
// `npx tsx src/db/import/2026.ts`. Safe-ish to re-run: households/people
// are matched by name where possible, and attendance/enrollment rows
// have unique constraints, but re-running will still create duplicate
// people for any name that didn't match cleanly the first time.
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { households } from "../schema/households";
import { people } from "../schema/people";
import { neighbourhoods } from "../schema/neighbourhoods";
import { activityInstances } from "../schema/activityInstances";
import { activityEnrollments } from "../schema/activityEnrollments";
import { attendanceEvents } from "../schema/attendanceEvents";
import { attendanceRecords } from "../schema/attendanceRecords";
import { user } from "../schema/auth";

const BASE =
  "/Users/michaelcohen/Library/CloudStorage/OneDrive-SharedLibraries-NSAoftheBahaisofAustralia/Aitkenvale Neighbourhood - General/Resources/Code";

function readCsv(filename: string): string[][] {
  const raw = fs.readFileSync(`${BASE}/${filename}`, "utf-8");
  return parse(raw, { columns: false, skip_empty_lines: false, relax_column_count: true }) as string[][];
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

// "01-Jan-12" (DOB, 2-digit year) or "17/04/2010" (DD/MM/YYYY) -> "YYYY-MM-DD". Anything else -> null.
function parseDob(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})-(\w{3})-(\d{2})$/);
  if (m) {
    const [, d, mon, yy] = m;
    const month = MONTHS[mon];
    if (!month) return null;
    const year = Number(yy) <= 30 ? 2000 + Number(yy) : 1900 + Number(yy);
    return `${year}-${month}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

// "26-Jan" (week-header date, no year) -> "2026-MM-DD".
function parseWeekDate(raw: string, year = 2026): string | null {
  const s = (raw || "").trim();
  const m = s.match(/^(\d{1,2})-(\w{3})$/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (!month) return null;
  return `${year}-${month}-${m[1].padStart(2, "0")}`;
}

const WEEKDAY_MAP: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

function extractWeekday(label: string): string | null {
  const m = label.match(/mon|tue|wed|thu|fri|sat|sun/i);
  return m ? WEEKDAY_MAP[m[0].toLowerCase()] : null;
}

async function main() {
  const [aitkenvale] = await db.select().from(neighbourhoods).where(eq(neighbourhoods.name, "Aitkenvale"));
  if (!aitkenvale) throw new Error("Aitkenvale neighbourhood not seeded — run src/db/seed.ts first.");

  const [importUser] = await db.select().from(user).limit(1);
  if (!importUser) throw new Error("No user account exists yet — sign up first so the import has someone to attribute records to.");

  // ---------- 1. Homes.csv -> households ----------
  const homesRows = readCsv("People & Attendance 2026 - Homes.csv").slice(1);
  const householdIdByName = new Map<string, string>();
  let householdsCreated = 0;
  for (const row of homesRows) {
    const [name, , hide, address] = row;
    const trimmedName = name?.trim();
    if (!trimmedName || householdIdByName.has(trimmedName)) continue; // skip blank + exact dupes (e.g. "Maria family" listed twice)
    const [created] = await db
      .insert(households)
      .values({
        name: trimmedName,
        address: address?.trim() || null,
        hidden: hide?.trim().toLowerCase() === "x",
      })
      .returning();
    householdIdByName.set(trimmedName, created.id);
    householdsCreated++;
  }

  // ---------- 2. People.csv -> people ----------
  const peopleRows = readCsv("People & Attendance 2026 - People.csv").slice(1);
  const personIdByName = new Map<string, string>();
  let peopleCreated = 0;
  let peopleNameCollisions = 0;
  for (const row of peopleRows) {
    const [name, householdName, , hide, mobile, dob, , bahai, category] = row;
    const trimmedName = name?.trim();
    if (!trimmedName) continue;
    const householdId = householdName?.trim() ? householdIdByName.get(householdName.trim()) ?? null : null;
    const cat = category?.trim() || null;
    const isAdult = cat ? /adult|youth/i.test(cat) : false; // "5. Youth" / "6. Adult" -> adult, else child
    const [created] = await db
      .insert(people)
      .values({
        householdId,
        name: trimmedName,
        personType: isAdult ? "adult" : "child",
        dob: parseDob(dob),
        mobile: mobile?.trim() || null,
        bahaiStatus: bahai?.trim() || null,
        category: cat,
        hidden: hide?.trim().toLowerCase() === "x",
        linkStatus: "linked",
        source: "bulk_import",
      })
      .returning();
    if (personIdByName.has(trimmedName)) peopleNameCollisions++;
    personIdByName.set(trimmedName, created.id);
    peopleCreated++;
  }

  // ---------- 3. PSEC.csv / JYSEP.csv -> activities + enrollments + attendance ----------
  let activitiesCreated = 0;
  let enrollmentsCreated = 0;
  let attendanceRecordsCreated = 0;
  let quickAddedFromRoster = 0;

  async function importProgramme(filename: string, categoryId: string, nameFor: (group: string) => string) {
    const rows = readCsv(filename);
    const [row0, row1] = rows;

    const weekCols: { col: number; date: string }[] = [];
    for (let col = 7; col < row0.length; col++) {
      if (!(row0[col] || "").trim().startsWith("Week")) continue; // skip Holidays / REGO / blank
      const date = parseWeekDate(row1[col] || "");
      if (date) weekCols.push({ col, date });
    }

    const dataRows = rows.slice(3).filter((r) => (r[2] || "").trim());
    const byGroup = new Map<string, string[][]>();
    for (const row of dataRows) {
      const group = (row[4] || "").trim();
      if (!group) continue;
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)!.push(row);
    }

    for (const [groupLabel, groupRows] of byGroup) {
      const facilitatorNames = groupRows
        .filter((r) => (r[5] || "").trim() === "fac.")
        .map((r) => (r[2] || "").trim());
      const weekday = extractWeekday(groupLabel);

      const [activity] = await db
        .insert(activityInstances)
        .values({
          categoryId,
          neighbourhoodId: aitkenvale.id,
          name: nameFor(groupLabel),
          description: facilitatorNames.length
            ? `Facilitators (not yet linked to an account): ${facilitatorNames.join(", ")}`
            : null,
          status: "active",
          cadenceType: weekday ? "weekly_term" : "ad_hoc",
          cadenceConfig: weekday ? { weekday, term_calendar_ref: "school_term_calendar" } : {},
        })
        .returning();
      activitiesCreated++;

      const eventIdByCol = new Map<number, string>();
      for (const wc of weekCols) {
        const hasData = groupRows.some((r) => {
          const v = (r[wc.col] || "").trim().toUpperCase();
          return v === "TRUE" || v === "FALSE";
        });
        if (!hasData) continue;
        const [ev] = await db
          .insert(attendanceEvents)
          .values({
            activityInstanceId: activity.id,
            sessionDate: wc.date,
            wasGeneratedFromCadence: true,
            createdByUserId: importUser.id,
          })
          .onConflictDoNothing()
          .returning();
        if (ev) eventIdByCol.set(wc.col, ev.id);
      }

      for (const row of groupRows) {
        const rawName = (row[2] || "").trim();
        if (!rawName) continue;

        let personId = personIdByName.get(rawName);
        if (!personId) {
          const [created] = await db
            .insert(people)
            .values({
              name: rawName,
              personType: (row[5] || "").trim() === "fac." ? "adult" : "child",
              linkStatus: "pending",
              source: "bulk_import",
            })
            .returning();
          personId = created.id;
          personIdByName.set(rawName, personId);
          quickAddedFromRoster++;
        }

        const [enrolled] = await db
          .insert(activityEnrollments)
          .values({ activityInstanceId: activity.id, personId })
          .onConflictDoNothing()
          .returning();
        if (enrolled) enrollmentsCreated++;

        for (const wc of weekCols) {
          const eventId = eventIdByCol.get(wc.col);
          if (!eventId) continue;
          const raw = (row[wc.col] || "").trim().toUpperCase();
          if (raw !== "TRUE" && raw !== "FALSE") continue;
          const [rec] = await db
            .insert(attendanceRecords)
            .values({
              attendanceEventId: eventId,
              personId,
              status: raw === "TRUE" ? "present" : "absent",
              recordedByUserId: importUser.id,
            })
            .onConflictDoNothing()
            .returning();
          if (rec) attendanceRecordsCreated++;
        }
      }
    }
  }

  await importProgramme("People & Attendance 2026 - PSEC.csv", "psec", (group) => {
    const m = group.match(/^G(\d)\s+(\w+)$/i);
    if (m) {
      const day = WEEKDAY_MAP[m[2].toLowerCase()] || m[2];
      return `Aitkenvale — ${day} — Grade ${m[1]}`;
    }
    return `Aitkenvale — ${group}`;
  });

  await importProgramme("People & Attendance 2026 - JYSEP.csv", "jysep", (group) => `Aitkenvale — ${group}`);

  console.log({
    householdsCreated,
    peopleCreated,
    peopleNameCollisions,
    activitiesCreated,
    enrollmentsCreated,
    attendanceRecordsCreated,
    quickAddedFromRoster,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
