"use server";

import { headers } from "next/headers";
import { and, eq, ilike, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { households } from "@/db/schema/households";
import { people } from "@/db/schema/people";
import { getCategoryLabel, CONTACT_INELIGIBLE_CATEGORIES } from "@/lib/category";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
}

export type HouseholdPatch = Partial<{
  name: string;
  address: string | null;
  notes: string | null;
  hidden: boolean;
  contactPersonId: string | null;
}>;

export async function updateHousehold(householdId: string, patch: HouseholdPatch) {
  await requireAdmin();
  await db.update(households).set(patch).where(eq(households.id, householdId));
}

export async function createHousehold(name: string) {
  await requireAdmin();
  const [created] = await db.insert(households).values({ name: name.trim() }).returning();
  return created;
}

// Who's eligible to be a household's contact — 15+ only (CONTACT_INELIGIBLE_CATEGORIES).
export async function searchPeopleForContact(query: string) {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await db
    .select({ id: people.id, name: people.name, preferredName: people.preferredName, dob: people.dob })
    .from(people)
    .where(and(eq(people.hidden, false), or(ilike(people.name, `%${q}%`), ilike(people.preferredName, `%${q}%`))))
    .limit(10);
  return rows.filter((r) => !CONTACT_INELIGIBLE_CATEGORIES.includes(getCategoryLabel(r.dob) ?? "")).map(({ id, name, preferredName }) => ({ id, name, preferredName }));
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

// Moves every person from the secondary household onto the primary, then
// hides the (now-empty) secondary — same soft-delete convention as
// mergePendingPerson for a duplicate person, kept for history rather than
// actually deleted. If the primary has no contact of its own yet but the
// secondary did, that contact carries over rather than being silently lost.
export async function mergeHouseholds(primaryId: string, secondaryId: string) {
  await requireAdmin();
  if (primaryId === secondaryId) throw new Error("Can't merge a household into itself");

  await db.update(people).set({ householdId: primaryId }).where(eq(people.householdId, secondaryId));

  const [primary] = await db.select({ contactPersonId: households.contactPersonId }).from(households).where(eq(households.id, primaryId));
  const [secondary] = await db.select({ contactPersonId: households.contactPersonId }).from(households).where(eq(households.id, secondaryId));
  if (!primary?.contactPersonId && secondary?.contactPersonId) {
    await db.update(households).set({ contactPersonId: secondary.contactPersonId }).where(eq(households.id, primaryId));
  }

  await db.update(households).set({ hidden: true }).where(eq(households.id, secondaryId));
}
