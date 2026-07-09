import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { people } from "@/db/schema/people";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { BulkAttendanceGrid, type ActivityBlock } from "./BulkAttendanceGrid";

export default async function AdminBulkAttendancePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const [activities, enrollments, events] = await Promise.all([
    db
      .select({ id: activityInstances.id, name: activityInstances.name, categoryLabel: activityCategories.label })
      .from(activityInstances)
      .leftJoin(activityCategories, eq(activityCategories.id, activityInstances.categoryId))
      .where(eq(activityInstances.hidden, false))
      .orderBy(asc(activityInstances.name)),
    db
      .select({
        activityInstanceId: activityEnrollments.activityInstanceId,
        personId: people.id,
        name: people.name,
        preferredName: people.preferredName,
      })
      .from(activityEnrollments)
      .innerJoin(people, eq(people.id, activityEnrollments.personId))
      .where(and(eq(activityEnrollments.role, "participant"), eq(activityEnrollments.active, true))),
    db
      .select({ id: attendanceEvents.id, activityInstanceId: attendanceEvents.activityInstanceId, sessionDate: attendanceEvents.sessionDate, locked: attendanceEvents.locked })
      .from(attendanceEvents)
      .orderBy(desc(attendanceEvents.sessionDate)),
  ]);

  const eventIds = events.map((e) => e.id);
  const records = eventIds.length
    ? await db
        .select({ attendanceEventId: attendanceRecords.attendanceEventId, personId: attendanceRecords.personId, status: attendanceRecords.status })
        .from(attendanceRecords)
        .where(inArray(attendanceRecords.attendanceEventId, eventIds))
    : [];

  const byDisplayName = (a: { name: string; preferredName: string | null }, b: { name: string; preferredName: string | null }) =>
    (a.preferredName || a.name).localeCompare(b.preferredName || b.name);

  const blockById = new Map<string, ActivityBlock>(
    activities.map((a) => [a.id, { id: a.id, name: a.name, categoryLabel: a.categoryLabel, participants: [], dates: [], statusByDatePerson: {} }]),
  );

  for (const e of enrollments) {
    blockById.get(e.activityInstanceId)?.participants.push({ personId: e.personId, name: e.name, preferredName: e.preferredName });
  }
  for (const block of blockById.values()) {
    block.participants.sort(byDisplayName);
  }

  // events is already sorted desc, so each block's subset stays desc too.
  const eventKeyById = new Map<string, { activityInstanceId: string; sessionDate: string }>();
  for (const ev of events) {
    const block = blockById.get(ev.activityInstanceId);
    if (!block) continue;
    block.dates.push({ sessionDate: ev.sessionDate, locked: ev.locked });
    eventKeyById.set(ev.id, { activityInstanceId: ev.activityInstanceId, sessionDate: ev.sessionDate });
  }

  for (const r of records) {
    const key = eventKeyById.get(r.attendanceEventId);
    if (!key) continue;
    const block = blockById.get(key.activityInstanceId);
    if (!block) continue;
    (block.statusByDatePerson[key.sessionDate] ??= {})[r.personId] = r.status;
  }

  // Nothing to bulk-edit for an activity with no one currently enrolled.
  const blocks = [...blockById.values()].filter((b) => b.participants.length > 0);

  return <BulkAttendanceGrid activities={blocks} />;
}
