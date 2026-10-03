import { headers } from "next/headers";
import { and, desc, eq, gte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { termDates } from "@/db/schema/termDates";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { getNextExpectedDate, getRecentExpectedDates, type CadenceConfig, type CadenceType } from "@/lib/cadence";
import { getEditWindowMonths } from "@/lib/settings";
import { studyLogsForCategory } from "@/lib/studyTracks";
import { SessionClient } from "./SessionClient";

// How many date pills the row holds. It scrolls sideways when they don't all fit.
const PILL_COUNT = 6;

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string; activityInstanceId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { categoryId, activityInstanceId } = await params;
  const { date } = await searchParams;

  const householdContacts = alias(people, "household_contacts");

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
        dob: people.dob,
        mobile: people.mobile,
        householdId: people.householdId,
        householdName: households.name,
        householdAddress: households.address,
        householdContactPersonId: households.contactPersonId,
        householdContactName: householdContacts.name,
        householdContactPreferredName: householdContacts.preferredName,
        householdContactMobile: householdContacts.mobile,
        regoYear: people.regoYear,
        regoFormUrl: people.regoFormUrl,
        role: activityEnrollments.role,
        active: activityEnrollments.active,
      })
      .from(activityEnrollments)
      .innerJoin(people, eq(people.id, activityEnrollments.personId))
      .leftJoin(households, eq(households.id, people.householdId))
      .leftJoin(householdContacts, eq(householdContacts.id, households.contactPersonId))
      .where(eq(activityEnrollments.activityInstanceId, activityInstanceId)),
    getEditWindowMonths(),
  ]);
  const isAdmin = session?.user?.role === "admin";

  const termRanges = terms.map((t) => ({ startDate: t.startDate, endDate: t.endDate }));
  const cadenceType = activity.cadenceType as CadenceType;
  const cadenceConfig = activity.cadenceConfig as CadenceConfig;
  const nextExpected = getNextExpectedDate(cadenceType, cadenceConfig, termRanges, activity.startDate);
  const cadenceRecentDates = getRecentExpectedDates(cadenceType, cadenceConfig, termRanges, PILL_COUNT, activity.startDate);

  // "Pick Date" lists dates the activity was actually held (a real
  // attendance_events row), not cadence-computed guesses — scoped to the
  // same edit window as everything else here, not every date ever recorded.
  const editWindowCutoff = new Date();
  editWindowCutoff.setMonth(editWindowCutoff.getMonth() - editWindowMonths);
  const heldEvents = await db
    .select({ sessionDate: attendanceEvents.sessionDate })
    .from(attendanceEvents)
    .where(and(eq(attendanceEvents.activityInstanceId, activityInstanceId), gte(attendanceEvents.sessionDate, editWindowCutoff.toISOString().slice(0, 10))))
    .orderBy(desc(attendanceEvents.sessionDate));
  const heldDates = heldEvents.map((e) => e.sessionDate);

  // With no date in the URL, open on the date the cadence expects — or, for
  // an activity that has none to suggest (every ad-hoc one), on the most
  // recent session that really exists: where you left off. Falling straight
  // through to today's date used to invent one, which then showed up as a
  // selected date pill every time the activity was reopened, as if someone
  // had added it. Today is only the last resort, for an activity with no
  // sessions yet (and the screen then asks for a date — see
  // needsDateConfirmation below).
  const selectedDate = date || nextExpected || heldDates[0] || new Date().toISOString().slice(0, 10);

  const existingEvent = await db.query.attendanceEvents.findFirst({
    where: and(eq(attendanceEvents.activityInstanceId, activityInstanceId), eq(attendanceEvents.sessionDate, selectedDate)),
  });

  const existingRecords = existingEvent
    ? await db.select().from(attendanceRecords).where(eq(attendanceRecords.attendanceEventId, existingEvent.id))
    : [];

  const statusByPersonId = Object.fromEntries(existingRecords.map((r) => [r.personId, r.status]));

  // The quick-pick pills: the most recent dates the activity has, newest first.
  // That is every session that really exists — whether the cadence made it or
  // someone added it with "Or add new event date" — plus the dates the cadence
  // expects, even where nobody has taken attendance yet (so a forgotten week can
  // still be caught up). Before, only the cadence's dates were offered, so a date
  // added outside it never showed. An ad-hoc activity has no cadence, so its
  // pills are just its real sessions.
  const recentDates = [...new Set([...heldDates, ...cadenceRecentDates])].sort().reverse().slice(0, PILL_COUNT);

  // An ad-hoc activity with no sessions yet has no cadence to suggest a date
  // from, so selectedDate above falls all the way through to "today" with
  // nothing to signal that's just a guess, not a deliberate choice. Once any
  // date has actually been picked (?date= is present) or a session already
  // exists, this stops applying — it's only for the very first visit to a
  // brand-new ad-hoc activity.
  const needsDateConfirmation = cadenceType === "ad_hoc" && heldDates.length === 0 && !date;

  // The study logs this kind of activity keeps (Ruhi: units and branches on one screen).
  const studyLogs = studyLogsForCategory(activity.categoryId);

  return (
    <SessionClient
      categoryId={categoryId}
      activityInstanceId={activityInstanceId}
      activityName={activity.name}
      selectedDate={selectedDate}
      recentDates={recentDates}
      heldDates={heldDates}
      roster={roster}
      statusByPersonId={statusByPersonId}
      isAdmin={isAdmin}
      editWindowMonths={editWindowMonths}
      needsDateConfirmation={needsDateConfirmation}
      studyLog={studyLogs ? { title: studyLogs.title, trackIds: studyLogs.tracks.map((t) => t.id) } : null}
    />
  );
}
