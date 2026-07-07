"use server";

import { headers } from "next/headers";
import { and, eq, ilike } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in");
  return session.user.id;
}

async function getOrCreateEventId(activityInstanceId: string, sessionDate: string, userId: string) {
  const existing = await db.query.attendanceEvents.findFirst({
    where: and(eq(attendanceEvents.activityInstanceId, activityInstanceId), eq(attendanceEvents.sessionDate, sessionDate)),
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(attendanceEvents)
    .values({ activityInstanceId, sessionDate, wasGeneratedFromCadence: false, createdByUserId: userId })
    .returning();
  return created.id;
}

// Lazily creates the session (attendance_events row) for this date on first
// mark, rather than on every page view — browsing a date shouldn't create a
// session until a real attendance decision is recorded against it.
export async function setAttendance(
  activityInstanceId: string,
  sessionDate: string,
  personId: string,
  status: "present" | "absent",
) {
  const userId = await requireUserId();
  const eventId = await getOrCreateEventId(activityInstanceId, sessionDate, userId);
  await db
    .insert(attendanceRecords)
    .values({ attendanceEventId: eventId, personId, status, recordedByUserId: userId })
    .onConflictDoUpdate({
      target: [attendanceRecords.attendanceEventId, attendanceRecords.personId],
      set: { status, recordedByUserId: userId, recordedAt: new Date() },
    });
}

export async function getLockStatus(activityInstanceId: string, sessionDate: string): Promise<boolean> {
  await requireUserId();
  const existing = await db.query.attendanceEvents.findFirst({
    where: and(eq(attendanceEvents.activityInstanceId, activityInstanceId), eq(attendanceEvents.sessionDate, sessionDate)),
  });
  return existing?.locked ?? false;
}

// Confirm = lock (attendance becomes read-only). Clicking the status pill
// while locked unlocks it again so edits can be made.
export async function setLockStatus(activityInstanceId: string, sessionDate: string, locked: boolean) {
  const userId = await requireUserId();
  const eventId = await getOrCreateEventId(activityInstanceId, sessionDate, userId);
  await db.update(attendanceEvents).set({ locked }).where(eq(attendanceEvents.id, eventId));
}

// Hidden people don't show up here — "hidden" means regular users can no
// longer find them. Admins can still see and un-hide them in the Edit All
// People spreadsheet.
export async function searchPeople(query: string) {
  await requireUserId();
  const q = query.trim();
  if (q.length < 2) return [];
  return db
    .select({ id: people.id, name: people.name, preferredName: people.preferredName, linkStatus: people.linkStatus })
    .from(people)
    .where(and(ilike(people.name, `%${q}%`), eq(people.hidden, false)))
    .limit(8);
}

export async function enrollExistingPerson(activityInstanceId: string, personId: string, role: "participant" | "facilitator") {
  await requireUserId();
  await db
    .insert(activityEnrollments)
    .values({ activityInstanceId, personId, role })
    .onConflictDoUpdate({
      target: [activityEnrollments.activityInstanceId, activityEnrollments.personId],
      set: { role, active: true },
    });
}

// Hide = stop showing this person on the day-to-day roster without deleting
// their attendance history. Show = bring them back.
export async function setEnrollmentActive(activityInstanceId: string, personId: string, active: boolean) {
  await requireUserId();
  await db
    .update(activityEnrollments)
    .set({ active })
    .where(and(eq(activityEnrollments.activityInstanceId, activityInstanceId), eq(activityEnrollments.personId, personId)));
}

export async function quickAddPerson(activityInstanceId: string, name: string, role: "participant" | "facilitator") {
  await requireUserId();
  const [created] = await db
    .insert(people)
    .values({
      name: name.trim(),
      personType: role === "facilitator" ? "adult" : "child",
      linkStatus: "pending",
      source: "quick_add",
    })
    .returning();
  await db.insert(activityEnrollments).values({ activityInstanceId, personId: created.id, role });
  return created;
}
