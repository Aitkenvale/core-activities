"use server";

import { headers } from "next/headers";
import { and, eq, ilike, notExists, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { getCategoryLabel, CONTACT_INELIGIBLE_CATEGORIES } from "@/lib/category";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
}

export type PersonPatch = Partial<{
  name: string;
  preferredName: string | null;
  dob: string | null;
  mobile: string | null;
  email: string | null;
  regoYear: number | null;
  regoFormUrl: string | null;
  comment: string | null;
  hidden: boolean;
  linkStatus: "linked" | "pending";
  householdId: string | null;
}>;

export async function updatePerson(personId: string, patch: PersonPatch) {
  await requireAdmin();
  await db.update(people).set(patch).where(eq(people.id, personId));
}

// A bare new person row — no household/DOB required up front, matching the
// same "just a name to start" pattern as the Households grid's own inline
// Add. personType defaults to "child" (same default PeopleSearch's
// AddHouseholdMemberForm uses absent a DOB) — the rest of this grid's
// fields (DOB, household, etc.) are filled in afterwards via the normal
// inline editing already on every row.
export async function createPerson(name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  const [created] = await db.insert(people).values({ name: trimmed, personType: "child" }).returning({ id: people.id });
  return created;
}

export type PersonMergeFieldValues = {
  name: string;
  preferredName: string | null;
  dob: string | null;
  householdId: string | null;
  mobile: string | null;
  email: string | null;
  regoYear: number | null;
  regoFormUrl: string | null;
  comment: string | null;
};

// Merges 2 or 3 People rows into one, field by field — the admin has
// already resolved every field's winning value client-side (the compare
// grid in PersonMergeDialog), this just applies that result and moves the
// losers' history over. Same reasoning/pattern as mergePendingPerson
// (attendance session actions) and mergeHouseholds: enrollments/attendance
// records move to the survivor (dropping any that would collide with one
// the survivor already has), a loser who was some household's contact
// hands that off to the survivor, and the losers are soft-hidden rather
// than deleted. Not wrapped in a transaction — the neon-http driver doesn't
// support one — but every step is idempotent/NOT-EXISTS-guarded, so a
// partial re-run is harmless.
export async function mergePeople(survivorId: string, loserIds: string[], fieldValues: PersonMergeFieldValues) {
  await requireAdmin();
  const uniqueLoserIds = [...new Set(loserIds)].filter((id) => id !== survivorId);
  if (uniqueLoserIds.length === 0) throw new Error("Nothing to merge");

  await db.update(people).set(fieldValues).where(eq(people.id, survivorId));

  for (const loserId of uniqueLoserIds) {
    const enrollmentsTarget = alias(activityEnrollments, "enrollments_target");
    await db
      .update(activityEnrollments)
      .set({ personId: survivorId })
      .where(
        and(
          eq(activityEnrollments.personId, loserId),
          notExists(
            db
              .select()
              .from(enrollmentsTarget)
              .where(
                and(
                  eq(enrollmentsTarget.activityInstanceId, activityEnrollments.activityInstanceId),
                  eq(enrollmentsTarget.personId, survivorId),
                ),
              ),
          ),
        ),
      );
    // Anything left is a duplicate — the survivor was already enrolled there.
    await db.delete(activityEnrollments).where(eq(activityEnrollments.personId, loserId));

    const recordsTarget = alias(attendanceRecords, "records_target");
    await db
      .update(attendanceRecords)
      .set({ personId: survivorId })
      .where(
        and(
          eq(attendanceRecords.personId, loserId),
          notExists(
            db
              .select()
              .from(recordsTarget)
              .where(and(eq(recordsTarget.attendanceEventId, attendanceRecords.attendanceEventId), eq(recordsTarget.personId, survivorId))),
          ),
        ),
      );
    // Anything left is a duplicate mark for a session the survivor already has a record for.
    await db.delete(attendanceRecords).where(eq(attendanceRecords.personId, loserId));

    await db.update(households).set({ contactPersonId: survivorId }).where(eq(households.contactPersonId, loserId));

    await db.update(people).set({ hidden: true }).where(eq(people.id, loserId));
  }
}

// A real hard delete — but only when nothing would be lost. People are
// normally soft-hidden (see mergePeople above) because activityEnrollments
// and attendanceRecords cascade-delete when their person row goes, which
// would silently wipe real attendance history; households.contactPersonId
// has no FK at all, so deleting someone's contact would leave a dangling
// reference. This only allows deleting a person with none of that — a
// mistaken or duplicate blank entry — everything else should use Hide.
export async function deletePerson(personId: string) {
  await requireAdmin();

  const [isContact] = await db.select({ id: households.id }).from(households).where(eq(households.contactPersonId, personId)).limit(1);
  if (isContact) throw new Error("This person is a household's contact — change that household's contact first.");

  const [hasEnrollment] = await db.select({ id: activityEnrollments.id }).from(activityEnrollments).where(eq(activityEnrollments.personId, personId)).limit(1);
  if (hasEnrollment) throw new Error("This person has activity enrollments — use Hide instead of Delete.");

  const [hasAttendance] = await db.select({ id: attendanceRecords.id }).from(attendanceRecords).where(eq(attendanceRecords.personId, personId)).limit(1);
  if (hasAttendance) throw new Error("This person has attendance history — use Hide instead of Delete.");

  await db.delete(people).where(eq(people.id, personId));
}

export async function searchHouseholds(query: string) {
  await requireAdmin();
  const q = query.trim();
  if (!q) return db.select({ id: households.id, name: households.name }).from(households).limit(10);
  return db.select({ id: households.id, name: households.name }).from(households).where(ilike(households.name, `%${q}%`)).limit(10);
}

export async function createHousehold(name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  const [created] = await db.insert(households).values({ name: trimmed }).returning({ id: households.id, name: households.name });
  return created;
}

// Who's eligible to be a household's contact — 15+ only (CONTACT_INELIGIBLE_CATEGORIES).
export async function searchPeopleForContact(query: string) {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await db
    .select({ id: people.id, name: people.name, preferredName: people.preferredName, mobile: people.mobile, dob: people.dob })
    .from(people)
    .where(and(eq(people.hidden, false), or(ilike(people.name, `%${q}%`), ilike(people.preferredName, `%${q}%`))))
    .limit(10);
  return rows
    .filter((r) => !CONTACT_INELIGIBLE_CATEGORIES.includes(getCategoryLabel(r.dob) ?? ""))
    .map(({ id, name, preferredName, mobile }) => ({ id, name, preferredName, mobile }));
}

// Same reasoning as the attendance Add Info flow's createContactPerson — a
// bare person record, not enrolled anywhere, just so a household can point
// its contact at someone who isn't in People yet.
export async function createContactPerson(name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  const [created] = await db
    .insert(people)
    .values({ name: trimmed, personType: "adult", linkStatus: "pending", source: "quick_add" })
    .returning({ id: people.id, name: people.name, preferredName: people.preferredName });
  return created;
}

// Sets a household's contact and (if provided) that contact's own mobile
// number in one go — mirrors the Attendance Add Info flow's
// saveHouseholdContact, admin-gated here since this is Edit All People.
export async function saveHouseholdContact(householdId: string, contactPersonId: string | null, contactMobile: string | null) {
  await requireAdmin();
  await db.update(households).set({ contactPersonId }).where(eq(households.id, householdId));
  if (contactPersonId) {
    await db.update(people).set({ mobile: contactMobile || null }).where(eq(people.id, contactPersonId));
  }
}
