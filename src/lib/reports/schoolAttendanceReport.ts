import ExcelJS from "exceljs";
import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";

export type SchoolActivityOption = { id: string; name: string; categoryId: string; categoryLabel: string };

// Every PSEC/JYSEP activity currently running — hidden/archived ones are
// left off since this report is about who's attending now, not a
// historical record of every class that ever existed.
export async function getSchoolActivityOptions(): Promise<SchoolActivityOption[]> {
  const categories = await db.select().from(activityCategories);
  const categoryLabel = Object.fromEntries(categories.map((c) => [c.id, c.label]));

  const rows = await db
    .select({ id: activityInstances.id, name: activityInstances.name, categoryId: activityInstances.categoryId })
    .from(activityInstances)
    .where(and(inArray(activityInstances.categoryId, ["psec", "jysep"]), eq(activityInstances.hidden, false)))
    .orderBy(asc(activityInstances.name));

  return rows.map((r) => ({ ...r, categoryLabel: categoryLabel[r.categoryId] ?? r.categoryId.toUpperCase() }));
}

type RosterRow = { participantName: string; householdName: string | null; contactFullName: string | null; className: string };

async function getActivityRoster(activityId: string, className: string): Promise<RosterRow[]> {
  const householdContacts = alias(people, "household_contacts");

  const roster = await db
    .select({
      name: people.name,
      preferredName: people.preferredName,
      householdName: households.name,
      contactFullName: householdContacts.name,
    })
    .from(activityEnrollments)
    .innerJoin(people, eq(people.id, activityEnrollments.personId))
    .leftJoin(households, eq(households.id, people.householdId))
    .leftJoin(householdContacts, eq(householdContacts.id, households.contactPersonId))
    .where(
      and(
        eq(activityEnrollments.activityInstanceId, activityId),
        eq(activityEnrollments.role, "participant"),
        eq(activityEnrollments.active, true),
        eq(people.hidden, false),
      ),
    )
    .orderBy(asc(people.name));

  // AKA/preferred name, falling back to their formal name when they don't
  // have one — a school report should read the way the child is actually
  // known day to day, not their full legal name.
  return roster.map((r) => ({
    participantName: r.preferredName || r.name,
    householdName: r.householdName,
    contactFullName: r.contactFullName,
    className,
  }));
}

// A flat spreadsheet, not a page-per-class PDF — every active participant
// across every selected activity as one row, with the class name as its own
// column so it can be sorted/filtered the same way a school would want to
// work with it (rather than flipping between PDF pages).
export async function generateSchoolAttendanceReportXlsx(activityIds: string[]): Promise<Buffer> {
  if (activityIds.length === 0) throw new Error("Select at least one activity.");

  const options = await getSchoolActivityOptions();
  const byId = new Map(options.map((o) => [o.id, o]));
  const selected = activityIds.map((id) => byId.get(id)).filter((o): o is SchoolActivityOption => Boolean(o));
  if (selected.length === 0) throw new Error("None of the selected activities could be found.");

  const rosters = await Promise.all(selected.map((a) => getActivityRoster(a.id, a.name)));
  const rows = rosters.flat().sort((a, b) => a.className.localeCompare(b.className) || a.participantName.localeCompare(b.participantName));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("School Attendance");
  sheet.columns = [
    { header: "Participant Name", key: "participantName", width: 28 },
    { header: "Household Name", key: "householdName", width: 28 },
    { header: "Household Contact Full Name", key: "contactFullName", width: 30 },
    { header: "Class Name", key: "className", width: 28 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow({
      participantName: r.participantName,
      householdName: r.householdName ?? "",
      contactFullName: r.contactFullName ?? "",
      className: r.className,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
