"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { termDates } from "@/db/schema/termDates";
import type { CadenceType, CadenceConfig } from "@/lib/cadence";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
}

export type ActivityPatch = Partial<{
  name: string;
  categoryId: string;
  neighbourhoodId: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  hidden: boolean;
  status: "active" | "paused";
  pausedAt: string | null;
}>;

export async function updateActivity(id: string, patch: ActivityPatch) {
  await requireAdmin();
  await db.update(activityInstances).set(patch).where(eq(activityInstances.id, id));
}

// Flipping status also drives pausedAt, since the paused-too-long warning
// badge is computed from it — kept as one action so the two can't drift out
// of sync.
export async function setActivityStatus(id: string, status: "active" | "paused") {
  await requireAdmin();
  await db
    .update(activityInstances)
    .set({ status, pausedAt: status === "paused" ? new Date().toISOString().slice(0, 10) : null })
    .where(eq(activityInstances.id, id));
}

// Ending a class works like hiding a person/household, plus records when —
// unchecking brings it back and clears the end date.
export async function setActivityHidden(id: string, hidden: boolean) {
  await requireAdmin();
  await db
    .update(activityInstances)
    .set({ hidden, endDate: hidden ? new Date().toISOString().slice(0, 10) : null })
    .where(eq(activityInstances.id, id));
}

export async function updateActivityCadence(id: string, cadenceType: CadenceType, cadenceConfig: CadenceConfig) {
  await requireAdmin();
  await db.update(activityInstances).set({ cadenceType, cadenceConfig }).where(eq(activityInstances.id, id));
}

export async function createActivity(input: {
  name: string;
  categoryId: string;
  neighbourhoodId: string;
  startDate: string | null;
}) {
  await requireAdmin();
  const [created] = await db
    .insert(activityInstances)
    .values({
      name: input.name.trim(),
      categoryId: input.categoryId,
      neighbourhoodId: input.neighbourhoodId,
      startDate: input.startDate,
      cadenceType: "ad_hoc",
      cadenceConfig: {},
    })
    .returning();
  return created;
}

export async function createTermDate(input: { year: number; termNumber: number; startDate: string; endDate: string }) {
  await requireAdmin();
  const [created] = await db.insert(termDates).values(input).returning();
  return created;
}

export async function updateTermDate(id: string, patch: Partial<{ year: number; termNumber: number; startDate: string; endDate: string }>) {
  await requireAdmin();
  await db.update(termDates).set(patch).where(eq(termDates.id, id));
}
