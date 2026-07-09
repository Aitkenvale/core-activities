"use server";

import { headers } from "next/headers";
import { and, eq, ilike, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { getEditWindowMonths } from "@/lib/settings";

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in");
  return session;
}

async function requireUserId() {
  const session = await requireSession();
  return session.user.id;
}

// Facilitators can only edit recent history — admins are unrestricted, for
// corrections. Reinforces the `locked` flag rather than replacing it: this
// still applies even if a session was never explicitly confirmed/locked.
// The window itself is an admin-editable setting (Settings > Security).
async function assertWithinEditWindow(sessionDate: string, role: string) {
  if (role === "admin") return;
  const months = await getEditWindowMonths();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  if (sessionDate < cutoff.toISOString().slice(0, 10)) {
    throw new Error(`Only an admin can edit sessions more than ${months} months old.`);
  }
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
  const session = await requireSession();
  await assertWithinEditWindow(sessionDate, session.user.role);
  const userId = session.user.id;
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
// while locked unlocks it again so edits can be made — gated the same as
// setAttendance, otherwise a facilitator could just unlock an old session
// to get around the edit window.
export async function setLockStatus(activityInstanceId: string, sessionDate: string, locked: boolean) {
  const session = await requireSession();
  await assertWithinEditWindow(sessionDate, session.user.role);
  const eventId = await getOrCreateEventId(activityInstanceId, sessionDate, session.user.id);
  await db.update(attendanceEvents).set({ locked }).where(eq(attendanceEvents.id, eventId));
}

export async function getCancelledStatus(activityInstanceId: string, sessionDate: string): Promise<boolean> {
  await requireUserId();
  const existing = await db.query.attendanceEvents.findFirst({
    where: and(eq(attendanceEvents.activityInstanceId, activityInstanceId), eq(attendanceEvents.sessionDate, sessionDate)),
  });
  return existing?.cancelled ?? false;
}

// "Class Cancelled" — the facilitator is saying no session happened at all
// (holiday, facilitator away, etc.), not that attendance is all-absent.
// Same edit-window gating as setLockStatus.
export async function setCancelledStatus(activityInstanceId: string, sessionDate: string, cancelled: boolean) {
  const session = await requireSession();
  await assertWithinEditWindow(sessionDate, session.user.role);
  const eventId = await getOrCreateEventId(activityInstanceId, sessionDate, session.user.id);
  await db.update(attendanceEvents).set({ cancelled }).where(eq(attendanceEvents.id, eventId));
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

export async function searchHouseholdsForRoster(query: string) {
  await requireUserId();
  const q = query.trim();
  if (!q) return db.select({ id: households.id, name: households.name }).from(households).limit(10);
  return db.select({ id: households.id, name: households.name }).from(households).where(ilike(households.name, `%${q}%`)).limit(10);
}

// "Add Info" — filling in what's actually missing on a quick-added person
// (DOB, household, rego year), not admin-only: this is a natural extension
// of quick-adding them in the first place, which is already a facilitator
// action, not a spreadsheet-level edit. Only the keys the caller actually
// includes get touched (a plain partial update, same convention as every
// other People patch action in the app) — omit a key entirely to leave it
// alone, don't pass it as undefined.
export async function updatePersonInfo(
  personId: string,
  patch: Partial<{ name: string; dob: string | null; householdId: string | null; regoYear: number | null }>,
) {
  await requireUserId();
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error("Name is required");
    patch = { ...patch, name: trimmed };
  }
  await db.update(people).set(patch).where(eq(people.id, personId));
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

// Folds a "Not Linked" (quick-added, pending) person's enrollments and
// attendance history onto an already-existing real person — for when a
// facilitator quick-added someone who, it turns out, was already a proper
// People record under a fuller name. Admin-only, matching every other
// People-data change in the app. Not wrapped in a transaction: the neon-http
// driver doesn't support one, but each step is a NOT EXISTS-guarded
// move-or-drop, so re-running a partially-completed merge is harmless.
export async function mergePendingPerson(pendingPersonId: string, targetPersonId: string) {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new Error("Admin only");
  if (pendingPersonId === targetPersonId) throw new Error("Can't merge a person into themselves");

  const enrollmentsTarget = alias(activityEnrollments, "enrollments_target");
  await db
    .update(activityEnrollments)
    .set({ personId: targetPersonId })
    .where(
      and(
        eq(activityEnrollments.personId, pendingPersonId),
        notExists(
          db
            .select()
            .from(enrollmentsTarget)
            .where(
              and(
                eq(enrollmentsTarget.activityInstanceId, activityEnrollments.activityInstanceId),
                eq(enrollmentsTarget.personId, targetPersonId),
              ),
            ),
        ),
      ),
    );
  // Anything left is a duplicate the target was already enrolled in.
  await db.delete(activityEnrollments).where(eq(activityEnrollments.personId, pendingPersonId));

  const recordsTarget = alias(attendanceRecords, "records_target");
  await db
    .update(attendanceRecords)
    .set({ personId: targetPersonId })
    .where(
      and(
        eq(attendanceRecords.personId, pendingPersonId),
        notExists(
          db
            .select()
            .from(recordsTarget)
            .where(
              and(
                eq(recordsTarget.attendanceEventId, attendanceRecords.attendanceEventId),
                eq(recordsTarget.personId, targetPersonId),
              ),
            ),
        ),
      ),
    );
  // Anything left is a duplicate mark for a session the target already has a record for.
  await db.delete(attendanceRecords).where(eq(attendanceRecords.personId, pendingPersonId));

  // The duplicate is now empty — hide it so it stops surfacing anywhere
  // (Find Person, quick-add search, etc.).
  await db.update(people).set({ hidden: true }).where(eq(people.id, pendingPersonId));
}
