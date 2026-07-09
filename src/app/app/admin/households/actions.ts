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
