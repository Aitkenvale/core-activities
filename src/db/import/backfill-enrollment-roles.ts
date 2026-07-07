// One-off: activity_enrollments.role didn't exist when the 2026 import ran,
// so every row defaulted to "participant". Re-reads the same source CSVs to
// correctly mark facilitators.
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { eq, and } from "drizzle-orm";
import { db } from "../client";
import { people } from "../schema/people";
import { activityInstances } from "../schema/activityInstances";
import { activityEnrollments } from "../schema/activityEnrollments";

const BASE =
  "/Users/michaelcohen/Library/CloudStorage/OneDrive-SharedLibraries-NSAoftheBahaisofAustralia/Aitkenvale Neighbourhood - General/Resources/Code";

function readCsv(filename: string): string[][] {
  const raw = fs.readFileSync(`${BASE}/${filename}`, "utf-8");
  return parse(raw, { columns: false, skip_empty_lines: false, relax_column_count: true }) as string[][];
}

const WEEKDAY_MAP: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

async function backfill(filename: string, nameFor: (group: string) => string) {
  const rows = readCsv(filename);
  const dataRows = rows.slice(3).filter((r) => (r[2] || "").trim());

  let updated = 0;
  for (const row of dataRows) {
    if ((row[5] || "").trim() !== "fac.") continue;
    const personName = (row[2] || "").trim();
    const group = (row[4] || "").trim();
    if (!personName || !group) continue;

    const activityName = nameFor(group);
    const [activity] = await db.select().from(activityInstances).where(eq(activityInstances.name, activityName));
    const [person] = await db.select().from(people).where(eq(people.name, personName));
    if (!activity || !person) continue;

    const result = await db
      .update(activityEnrollments)
      .set({ role: "facilitator" })
      .where(and(eq(activityEnrollments.activityInstanceId, activity.id), eq(activityEnrollments.personId, person.id)))
      .returning();
    updated += result.length;
  }
  console.log(`${filename}: ${updated} enrollments marked as facilitator`);
}

async function main() {
  await backfill("People & Attendance 2026 - PSEC.csv", (group) => {
    const m = group.match(/^G(\d)\s+(\w+)$/i);
    if (m) {
      const day = WEEKDAY_MAP[m[2].toLowerCase()] || m[2];
      return `Aitkenvale — ${day} — Grade ${m[1]}`;
    }
    return `Aitkenvale — ${group}`;
  });

  await backfill("People & Attendance 2026 - JYSEP.csv", (group) => `Aitkenvale — ${group}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
