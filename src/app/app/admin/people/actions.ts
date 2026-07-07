"use server";

import { headers } from "next/headers";
import { eq, ilike } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
}

export type PersonPatch = Partial<{
  name: string;
  preferredName: string | null;
  personType: "child" | "adult";
  dob: string | null;
  mobile: string | null;
  email: string | null;
  bahaiStatus: string | null;
  category: string | null;
  comment: string | null;
  hidden: boolean;
  linkStatus: "linked" | "pending";
  householdId: string | null;
}>;

export async function updatePerson(personId: string, patch: PersonPatch) {
  await requireAdmin();
  await db.update(people).set(patch).where(eq(people.id, personId));
}

export async function searchHouseholds(query: string) {
  await requireAdmin();
  const q = query.trim();
  if (!q) return db.select({ id: households.id, name: households.name }).from(households).limit(10);
  return db.select({ id: households.id, name: households.name }).from(households).where(ilike(households.name, `%${q}%`)).limit(10);
}
