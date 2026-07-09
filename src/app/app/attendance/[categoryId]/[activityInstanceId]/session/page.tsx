import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { people } from "@/db/schema/people";
import { termDates } from "@/db/schema/termDates";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { getNextExpectedDate, getRecentExpectedDates, type CadenceConfig, type CadenceType } from "@/lib/cadence";
import { getEditWindowMonths } from "@/lib/settings";
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
  const [session, [activity], terms, roster, editWindowMonths] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    db.select().from(activityInstances).where(eq(activityInstances.id, activityInstanceId)),
    db.select().from(termDates),
    db
      .select({
        personId: people.id,
        name: people.name,
        preferredName: people.preferredName,
        linkStatus: people.linkStatus,
        role: activityEnrollments.role,
        active: activityEnrollments.active,
      })
      .from(activityEnrollments)
      .innerJoin(people, eq(people.id, activityEnrollments.personId))
      .where(eq(activityEnrollments.activityInstanceId, activityInstanceId)),
    getEditWindowMonths(),
  ]);
  const isAdmin = session?.user?.role === "admin";

  const termRanges = terms.map((t) => ({ startDate: t.startDate, endDate: t.endDate }));
  const cadenceType = activity.cadenceType as CadenceType;
  const cadenceConfig = activity.cadenceConfig as CadenceConfig;
  const nextExpected = getNextExpectedDate(cadenceType, cadenceConfig, termRanges, activity.startDate);
  const recentDates = getRecentExpectedDates(cadenceType, cadenceConfig, termRanges, 3, activity.startDate);
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
      isAdmin={isAdmin}
      editWindowMonths={editWindowMonths}
    />
  );
}
