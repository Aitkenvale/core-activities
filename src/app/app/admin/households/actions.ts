"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { households } from "@/db/schema/households";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
}

export type HouseholdPatch = Partial<{
  name: string;
  address: string | null;
  notes: string | null;
  hidden: boolean;
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
