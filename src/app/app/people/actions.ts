"use server";

import { headers } from "next/headers";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { activityInstances } from "@/db/schema/activityInstances";
import { getCategoryLabel, CONTACT_INELIGIBLE_CATEGORIES } from "@/lib/category";

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in");
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
}

// Hidden people don't show up here — same convention as every other person
// search in the app. Matching on household name too (not just the person's
// own name) means everyone in a matching household shows up, since the
// household name is already joined onto every one of their rows.
export async function searchPeopleDirectory(query: string) {
  await requireSession();
  const q = query.trim();
  if (q.length < 2) return [];
  const householdContacts = alias(people, "household_contacts");
  const rows = await db
    .select({
      id: people.id,
      name: people.name,
      preferredName: people.preferredName,
      householdId: people.householdId,
      householdName: households.name,
      householdAddress: households.address,
      householdContactPersonId: households.contactPersonId,
      householdContactName: householdContacts.name,
      householdContactPreferredName: householdContacts.preferredName,
      householdContactMobile: householdContacts.mobile,
      mobile: people.mobile,
      regoYear: people.regoYear,
      regoFormUrl: people.regoFormUrl,
      dob: people.dob,
      comment: people.comment,
    })
    .from(people)
    .leftJoin(households, eq(households.id, people.householdId))
    .leftJoin(householdContacts, eq(householdContacts.id, households.contactPersonId))
    .where(
      and(
        eq(people.hidden, false),
        or(ilike(people.name, `%${q}%`), ilike(people.preferredName, `%${q}%`), ilike(households.name, `%${q}%`)),
      ),
    )
    .limit(20);

  if (rows.length === 0) return [];

  // Activities currently shown on the person's card — on an active
  // (participant) roster, for an activity that's itself active and not
  // hidden. Matches the "current participant" definition used in Admin People.
  const activityRows = await db
    .select({ personId: activityEnrollments.personId, activityName: activityInstances.name })
    .from(activityEnrollments)
    .innerJoin(activityInstances, eq(activityInstances.id, activityEnrollments.activityInstanceId))
    .where(
      and(
        inArray(
          activityEnrollments.personId,
          rows.map((r) => r.id),
        ),
        eq(activityEnrollments.role, "participant"),
        eq(activityEnrollments.active, true),
        eq(activityInstances.status, "active"),
        eq(activityInstances.hidden, false),
      ),
    );
  const activitiesByPerson = new Map<string, string[]>();
  for (const { personId, activityName } of activityRows) {
    activitiesByPerson.set(personId, [...(activitiesByPerson.get(personId) ?? []), activityName]);
  }

  return rows.map((r) => ({ ...r, activities: activitiesByPerson.get(r.id) ?? [] }));
}

// The lightweight edit surface reachable from a search result — mobile,
// household address, and notes are the fields facilitators actually need to
// fix on the spot (a parent calls in with a new number/address), without
// sending them to the full admin spreadsheet. Admin-only, matching every
// other People-data change in the app.
export async function updatePersonName(id: string, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  await db.update(people).set({ name: trimmed }).where(eq(people.id, id));
}

export async function updatePersonMobile(id: string, mobile: string) {
  await requireAdmin();
  await db.update(people).set({ mobile: mobile.trim() || null }).where(eq(people.id, id));
}

export async function updatePersonPreferredName(id: string, preferredName: string) {
  await requireAdmin();
  await db.update(people).set({ preferredName: preferredName.trim() || null }).where(eq(people.id, id));
}

export async function updatePersonRegoYear(id: string, regoYear: number | null) {
  await requireAdmin();
  await db.update(people).set({ regoYear }).where(eq(people.id, id));
}

export async function updatePersonDob(id: string, dob: string | null) {
  await requireAdmin();
  await db.update(people).set({ dob: dob || null }).where(eq(people.id, id));
}

export async function updatePersonNotes(id: string, comment: string) {
  await requireAdmin();
  await db.update(people).set({ comment: comment.trim() || null }).where(eq(people.id, id));
}

export async function updateHouseholdAddress(householdId: string, address: string) {
  await requireAdmin();
  await db.update(households).set({ address: address.trim() || null }).where(eq(households.id, householdId));
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

// Reassigning someone to a different (or brand-new) household from the
// edit form — separate from updateHouseholdAddress, which only ever
// touches the household they're already in.
export async function assignHousehold(personId: string, householdId: string | null) {
  await requireAdmin();
  await db.update(people).set({ householdId }).where(eq(people.id, personId));
}

// Only ever called right after creating a brand-new household for this same
// person, when they confirm "yes, make me the contact" — an existing
// household's contact is changed elsewhere (Edit Households), not from here.
export async function setHouseholdContact(householdId: string, contactPersonId: string) {
  await requireAdmin();
  await db.update(households).set({ contactPersonId }).where(eq(households.id, householdId));
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

// Same reasoning as addHouseholdMember — a bare person record, not enrolled
// anywhere, just so a household can point its contact at someone who isn't
// in People yet.
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
// number in one go — the Contact field here edits both together, since
// Contact's Mobile is really "the contact's mobile," not this person's own.
export async function saveHouseholdContact(householdId: string, contactPersonId: string | null, contactMobile: string | null) {
  await requireAdmin();
  await db.update(households).set({ contactPersonId }).where(eq(households.id, householdId));
  if (contactPersonId) {
    await db.update(people).set({ mobile: contactMobile || null }).where(eq(people.id, contactPersonId));
  }
}

// "Add new babies etc." — a new household member (child or adult) found
// while looking someone up, without leaving Find Person for the full
// People grid.
export async function addHouseholdMember(householdId: string, name: string, personType: "child" | "adult", dob: string | null) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  const [created] = await db
    .insert(people)
    .values({ householdId, name: trimmed, personType, dob: dob || null })
    .returning();
  return created;
}
