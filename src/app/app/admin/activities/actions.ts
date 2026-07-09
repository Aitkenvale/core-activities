"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { termDates } from "@/db/schema/termDates";
import { neighbourhoods } from "@/db/schema/neighbourhoods";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { getExpectedDatesInRange, type CadenceType, type CadenceConfig } from "@/lib/cadence";
import type { ActivityStatus } from "@/app/app/activities/actions";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
  return session!;
}

export type ActivityPatch = Partial<{
  startDate: string | null;
}>;

// Start Date is the one field the full Edit Activity form deliberately
// hides (it's locked in at creation) — this grid's own inline edit is the
// one remaining place it can still be corrected.
export async function updateActivity(id: string, patch: ActivityPatch) {
  await requireAdmin();
  await db.update(activityInstances).set(patch).where(eq(activityInstances.id, id));
}

// Same one-way-Closed rule as updateActivityWithRoster (the full Edit
// Activity form's own status change) — once persisted as archived, nothing
// submitted here can move it back, even if this grid's pills somehow
// resubmitted a stale value.
export async function setActivityStatus(id: string, status: ActivityStatus) {
  await requireAdmin();
  const [current] = await db.select({ status: activityInstances.status }).from(activityInstances).where(eq(activityInstances.id, id));
  const prevStatus: ActivityStatus = (current?.status as ActivityStatus) ?? "active";
  const nextStatus: ActivityStatus = prevStatus === "archived" ? "archived" : status;
  const today = new Date().toISOString().slice(0, 10);

  await db
    .update(activityInstances)
    .set({
      status: nextStatus,
      hidden: nextStatus === "archived",
      ...(nextStatus === "paused" && prevStatus !== "paused" ? { pausedAt: today } : {}),
      ...(nextStatus !== "paused" ? { pausedAt: null } : {}),
      ...(nextStatus === "archived" && prevStatus !== "archived" ? { endDate: today } : {}),
      updatedAt: new Date(),
    })
    .where(eq(activityInstances.id, id));

  return nextStatus;
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

export async function createNeighbourhood(name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  const [created] = await db.insert(neighbourhoods).values({ name: trimmed }).returning();
  return created;
}

// Backfills attendance_events for every date the activity's own cadence
// says it should have run within [rangeStart, rangeEnd] — the app never
// generates these automatically (a session only exists once someone
// actually records attendance for it), so an activity that's gone a while
// without a facilitator visiting it has nothing to bulk-edit until this
// runs. onConflictDoNothing rather than a separate existence check first —
// the (activityInstanceId, sessionDate) unique constraint already does that
// work for free.
export async function bulkCreateEventsFromCadence(activityInstanceId: string, rangeStart: string, rangeEnd: string) {
  const session = await requireAdmin();
  const today = new Date().toISOString().slice(0, 10);
  if (rangeEnd > today) throw new Error("Can't create sessions for future dates.");
  if (rangeStart > rangeEnd) throw new Error("First date must be before last date.");

  const [activity] = await db.select().from(activityInstances).where(eq(activityInstances.id, activityInstanceId));
  if (!activity) throw new Error("Activity not found");
  if (activity.cadenceType === "ad_hoc") throw new Error("Ad-hoc activities have no cadence to generate dates from.");

  const terms = await db.select({ startDate: termDates.startDate, endDate: termDates.endDate }).from(termDates);
  const dates = getExpectedDatesInRange(
    activity.cadenceType as CadenceType,
    (activity.cadenceConfig ?? {}) as CadenceConfig,
    terms,
    rangeStart,
    rangeEnd,
    activity.startDate,
  );

  let created = 0;
  for (const sessionDate of dates) {
    const inserted = await db
      .insert(attendanceEvents)
      .values({ activityInstanceId, sessionDate, wasGeneratedFromCadence: true, createdByUserId: session.user.id })
      .onConflictDoNothing()
      .returning({ id: attendanceEvents.id });
    if (inserted.length > 0) created++;
  }
  return { created, skipped: dates.length - created };
}
