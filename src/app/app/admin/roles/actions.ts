"use server";

import { headers } from "next/headers";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { activityEnrollmentRoleHistory } from "@/db/schema/activityEnrollmentRoleHistory";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { people } from "@/db/schema/people";
import { getRoleLabels } from "@/lib/activityRoleLabels";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
  return session.user.id;
}

export type RoleHistoryEntry = { id: string; role: "facilitator" | "assistant"; effectiveFrom: string; recordedAt: string };

export type RoleRow = {
  enrollmentId: string;
  personId: string;
  name: string;
  preferredName: string | null;
  activityInstanceId: string;
  activityName: string;
  categoryId: string;
  categoryLabel: string;
  role: "facilitator" | "assistant";
  history: RoleHistoryEntry[];
};

// Everyone currently classified as a Facilitator or Assistant, grouped by
// category for the admin page — only categories that actually split the
// role (see activityRoleLabels.ts's showAssistants; Study Circle doesn't)
// are worth showing here at all. Each row carries its full change history
// so an admin can see (and correct) how it got there.
export async function getRoleManagementData(): Promise<RoleRow[]> {
  await requireAdmin();

  const rows = await db
    .select({
      enrollmentId: activityEnrollments.id,
      personId: people.id,
      name: people.name,
      preferredName: people.preferredName,
      activityInstanceId: activityInstances.id,
      activityName: activityInstances.name,
      categoryId: activityInstances.categoryId,
      categoryLabel: activityCategories.label,
      role: activityEnrollments.role,
    })
    .from(activityEnrollments)
    .innerJoin(people, eq(people.id, activityEnrollments.personId))
    .innerJoin(activityInstances, eq(activityInstances.id, activityEnrollments.activityInstanceId))
    .innerJoin(activityCategories, eq(activityCategories.id, activityInstances.categoryId))
    .where(
      and(
        inArray(activityEnrollments.role, ["facilitator", "assistant"]),
        eq(activityEnrollments.active, true),
        eq(activityInstances.hidden, false),
        eq(people.hidden, false),
      ),
    );

  const eligibleRows = rows.filter((r) => getRoleLabels(r.categoryId).showAssistants);
  const enrollmentIds = eligibleRows.map((r) => r.enrollmentId);

  const historyRows = enrollmentIds.length
    ? await db
        .select({
          id: activityEnrollmentRoleHistory.id,
          enrollmentId: activityEnrollmentRoleHistory.enrollmentId,
          role: activityEnrollmentRoleHistory.role,
          effectiveFrom: activityEnrollmentRoleHistory.effectiveFrom,
          recordedAt: activityEnrollmentRoleHistory.recordedAt,
        })
        .from(activityEnrollmentRoleHistory)
        .where(inArray(activityEnrollmentRoleHistory.enrollmentId, enrollmentIds))
        .orderBy(desc(activityEnrollmentRoleHistory.effectiveFrom))
    : [];

  const historyByEnrollment = new Map<string, RoleHistoryEntry[]>();
  for (const h of historyRows) {
    const entry: RoleHistoryEntry = { id: h.id, role: h.role as "facilitator" | "assistant", effectiveFrom: h.effectiveFrom, recordedAt: h.recordedAt.toISOString() };
    if (!historyByEnrollment.has(h.enrollmentId)) historyByEnrollment.set(h.enrollmentId, []);
    historyByEnrollment.get(h.enrollmentId)!.push(entry);
  }

  return eligibleRows
    .map((r) => ({ ...r, role: r.role as "facilitator" | "assistant", history: historyByEnrollment.get(r.enrollmentId) ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Same effect as the Attendance session's own "Move to X" (changeEnrollmentRole
// in session/actions.ts) — a new dated history row, not just the live column
// — but admin-gated and reachable from this dedicated management page rather
// than needing to open a specific activity's session first.
export async function toggleRole(activityInstanceId: string, personId: string, role: "facilitator" | "assistant") {
  const userId = await requireAdmin();
  const [updated] = await db
    .update(activityEnrollments)
    .set({ role })
    .where(and(eq(activityEnrollments.activityInstanceId, activityInstanceId), eq(activityEnrollments.personId, personId)))
    .returning({ id: activityEnrollments.id });
  if (!updated) return;
  await db.insert(activityEnrollmentRoleHistory).values({
    enrollmentId: updated.id,
    role,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    recordedByUserId: userId,
  });
}

// Corrects a mistaken entry — e.g. a facilitator toggling back and forth
// while figuring out what the button does. Deleting a middle entry just
// means date-based lookups fall back to whatever was in effect before it;
// always leaves at least one entry, since an enrollment must always have
// *some* role on record.
export async function deleteRoleHistoryEntry(historyId: string) {
  await requireAdmin();
  const [entry] = await db
    .select({ enrollmentId: activityEnrollmentRoleHistory.enrollmentId })
    .from(activityEnrollmentRoleHistory)
    .where(eq(activityEnrollmentRoleHistory.id, historyId));
  if (!entry) return;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityEnrollmentRoleHistory)
    .where(eq(activityEnrollmentRoleHistory.enrollmentId, entry.enrollmentId));
  if (Number(count) <= 1) throw new Error("Can't delete the only role record on file — toggle the role instead if this needs to change.");
  await db.delete(activityEnrollmentRoleHistory).where(eq(activityEnrollmentRoleHistory.id, historyId));
}
