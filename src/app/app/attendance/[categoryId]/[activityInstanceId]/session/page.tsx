import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { people } from "@/db/schema/people";
import { termDates } from "@/db/schema/termDates";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { getNextExpectedDate, getRecentExpectedDates, type CadenceConfig, type CadenceType } from "@/lib/cadence";
import { SessionClient } from "./SessionClient";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string; activityInstanceId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { categoryId, activityInstanceId } = await params;
  const { date } = await searchParams;

  // Independent queries — fire together instead of one round trip at a time.
  const [[activity], terms, roster] = await Promise.all([
    db.select().from(activityInstances).where(eq(activityInstances.id, activityInstanceId)),
    db.select().from(termDates),
    db
      .select({
        personId: people.id,
        name: people.name,
        preferredName: people.preferredName,
        linkStatus: people.linkStatus,
        role: activityEnrollments.role,
      })
      .from(activityEnrollments)
      .innerJoin(people, eq(people.id, activityEnrollments.personId))
      .where(and(eq(activityEnrollments.activityInstanceId, activityInstanceId), eq(activityEnrollments.active, true))),
  ]);

  const termRanges = terms.map((t) => ({ startDate: t.startDate, endDate: t.endDate }));
  const cadenceType = activity.cadenceType as CadenceType;
  const cadenceConfig = activity.cadenceConfig as CadenceConfig;
  const nextExpected = getNextExpectedDate(cadenceType, cadenceConfig, termRanges);
  const recentDates = getRecentExpectedDates(cadenceType, cadenceConfig, termRanges, 2);
  const selectedDate = date || nextExpected || new Date().toISOString().slice(0, 10);

  const existingEvent = await db.query.attendanceEvents.findFirst({
    where: and(eq(attendanceEvents.activityInstanceId, activityInstanceId), eq(attendanceEvents.sessionDate, selectedDate)),
  });

  const existingRecords = existingEvent
    ? await db.select().from(attendanceRecords).where(eq(attendanceRecords.attendanceEventId, existingEvent.id))
    : [];

  const statusByPersonId = Object.fromEntries(existingRecords.map((r) => [r.personId, r.status]));

  return (
    <SessionClient
      categoryId={categoryId}
      activityInstanceId={activityInstanceId}
      activityName={activity.name}
      selectedDate={selectedDate}
      recentDates={recentDates}
      roster={roster}
      statusByPersonId={statusByPersonId}
    />
  );
}
