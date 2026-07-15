"use server";

import { headers } from "next/headers";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { getCategoryLabel, FACILITATOR_INELIGIBLE_CATEGORIES, PARTICIPANT_INELIGIBLE_CATEGORIES } from "@/lib/category";
import type { CadenceType, CadenceConfig } from "@/lib/cadence";

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in");
  return session.user.id;
}

// Not admin-gated — any signed-in facilitator can create a new activity,
// same as the "Create New Activity" tile living under the non-admin User
// section of the home hub (mirrors quick-add-a-person already being
// non-admin elsewhere in the attendance flow).
//
// No SQL LIMIT here — People is a few hundred rows total, trivial to fetch
// in full. An earlier LIMIT 100 (applied before the category filter) cut
// off legitimate matches whenever a category's members sorted past the
// 100th row alphabetically ("Adult" and "Young Child" filters both cut off
// mid-alphabet as a result) — filtering needs to see everyone, not just an
// arbitrary early slice.
export async function searchPeopleForPicker(query: string, categories: string[], role?: "facilitator" | "participant") {
  await requireUserId();
  const q = query.trim();
  if (q.length < 2 && categories.length === 0) return [];

  const rows = await db
    .select({ id: people.id, name: people.name, preferredName: people.preferredName, linkStatus: people.linkStatus, dob: people.dob })
    .from(people)
    .where(
      and(
        eq(people.hidden, false),
        q.length >= 2 ? or(ilike(people.name, `%${q}%`), ilike(people.preferredName, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(people.name);

  let filtered = rows;
  if (categories.length > 0) {
    filtered = filtered.filter((r) => categories.includes(getCategoryLabel(r.dob) ?? ""));
  }
  if (role === "facilitator") {
    filtered = filtered.filter((r) => !FACILITATOR_INELIGIBLE_CATEGORIES.includes(getCategoryLabel(r.dob) ?? ""));
  }
  if (role === "participant") {
    filtered = filtered.filter((r) => !PARTICIPANT_INELIGIBLE_CATEGORIES.includes(getCategoryLabel(r.dob) ?? ""));
  }
  return filtered.map(({ id, name, preferredName, linkStatus }) => ({ id, name, preferredName, linkStatus }));
}

type PersonInput =
  | { kind: "existing"; id: string }
  // tempId (PickedPerson's client-side id) round-trips back in the response
  // so a caller that re-sends this same roster on a later autosave can
  // upgrade this entry to "existing" locally — otherwise every repeated
  // save of an unresolved "new" entry would insert another duplicate person.
  | { kind: "new"; name: string; tempId?: string };

export async function createActivityWithRoster(input: {
  name: string;
  categoryId: string;
  neighbourhoodId: string;
  startDate: string | null;
  cadenceType: CadenceType;
  cadenceConfig: CadenceConfig;
  notes: string;
  facilitators: PersonInput[];
  participants: PersonInput[];
}) {
  await requireUserId();
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("Name is required");

  const [activity] = await db
    .insert(activityInstances)
    .values({
      name: trimmedName,
      categoryId: input.categoryId,
      neighbourhoodId: input.neighbourhoodId,
      startDate: input.startDate,
      description: input.notes.trim() || null,
      cadenceType: input.cadenceType,
      cadenceConfig: input.cadenceConfig,
    })
    .returning();

  const createdPeople: { tempId: string; id: string }[] = [];

  async function enroll(entries: PersonInput[], role: "participant" | "facilitator") {
    for (const entry of entries) {
      let personId: string;
      if (entry.kind === "existing") {
        personId = entry.id;
      } else {
        personId = (
          await db
            .insert(people)
            .values({
              name: entry.name.trim(),
              personType: role === "facilitator" ? "adult" : "child",
              linkStatus: "pending",
              source: "quick_add",
            })
            .returning()
        )[0].id;
        if (entry.tempId) createdPeople.push({ tempId: entry.tempId, id: personId });
      }
      await db.insert(activityEnrollments).values({ activityInstanceId: activity.id, personId, role });
    }
  }

  await enroll(input.facilitators, "facilitator");
  await enroll(input.participants, "participant");

  return { ...activity, createdPeople };
}

// Not admin-gated, same reasoning as searchPeopleForPicker above — any
// signed-in facilitator can edit an activity, not just admins. Complete
// (hidden) activities are excluded — those belong in the admin grid's
// "Complete" filter, not here.
export async function searchActivitiesForPicker(query: string) {
  await requireUserId();
  const rows = await db
    .select({ id: activityInstances.id, name: activityInstances.name, categoryId: activityInstances.categoryId })
    .from(activityInstances)
    .where(eq(activityInstances.hidden, false))
    .orderBy(asc(activityInstances.name));

  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.name.toLowerCase().includes(q));
}

export type ActivityStatus = "active" | "paused" | "archived";

export type ActivityForEdit = {
  id: string;
  name: string;
  categoryId: string;
  neighbourhoodId: string;
  startDate: string | null;
  cadenceType: CadenceType;
  cadenceConfig: CadenceConfig;
  notes: string;
  status: ActivityStatus;
  facilitators: { kind: "existing"; id: string; name: string; preferredName: string | null; linkStatus: "linked" | "pending" }[];
  participants: { kind: "existing"; id: string; name: string; preferredName: string | null; linkStatus: "linked" | "pending" }[];
};

export async function getActivityForEdit(activityInstanceId: string): Promise<ActivityForEdit | null> {
  await requireUserId();
  const [activity] = await db.select().from(activityInstances).where(eq(activityInstances.id, activityInstanceId));
  if (!activity) return null;

  const roster = await db
    .select({
      personId: people.id,
      name: people.name,
      preferredName: people.preferredName,
      linkStatus: people.linkStatus,
      role: activityEnrollments.role,
    })
    .from(activityEnrollments)
    .innerJoin(people, eq(people.id, activityEnrollments.personId))
    .where(and(eq(activityEnrollments.activityInstanceId, activityInstanceId), eq(activityEnrollments.active, true)));

  function byRole(role: "facilitator" | "participant") {
    return roster
      .filter((r) => r.role === role)
      .map((r) => ({ kind: "existing" as const, id: r.personId, name: r.name, preferredName: r.preferredName, linkStatus: r.linkStatus }));
  }

  return {
    id: activity.id,
    name: activity.name,
    categoryId: activity.categoryId,
    neighbourhoodId: activity.neighbourhoodId,
    startDate: activity.startDate,
    cadenceType: activity.cadenceType as CadenceType,
    cadenceConfig: (activity.cadenceConfig ?? {}) as CadenceConfig,
    notes: activity.description ?? "",
    status: activity.status,
    facilitators: byRole("facilitator"),
    participants: byRole("participant"),
  };
}

// Reconciles the desired roster against whoever's currently actively
// enrolled — same enroll/disable pattern as the attendance session's own
// roster actions (enrollExistingPerson / setEnrollmentActive), rather than
// wiping and recreating enrollments, so attendance history tied to an
// enrollment (if any is ever added later) isn't disturbed by an edit.
export async function updateActivityWithRoster(
  activityInstanceId: string,
  input: {
    name: string;
    categoryId: string;
    neighbourhoodId: string;
    cadenceType: CadenceType;
    cadenceConfig: CadenceConfig;
    notes: string;
    status: ActivityStatus;
    facilitators: PersonInput[];
    participants: PersonInput[];
  },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in");
  const isAdmin = session.user.role === "admin";
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("Name is required");

  const [current] = await db.select({ status: activityInstances.status }).from(activityInstances).where(eq(activityInstances.id, activityInstanceId));
  const prevStatus: ActivityStatus = (current?.status as ActivityStatus) ?? "active";
  // Ending is one-way for a regular user — once persisted, nothing they
  // submit can move it back to Active/Paused (the UI itself already locks
  // their pills at that point). An admin using this same form can still
  // reverse it, since editing happens here regardless of who opened it.
  const nextStatus: ActivityStatus = !isAdmin && prevStatus === "archived" ? "archived" : input.status;
  const today = new Date().toISOString().slice(0, 10);

  await db
    .update(activityInstances)
    .set({
      name: trimmedName,
      categoryId: input.categoryId,
      neighbourhoodId: input.neighbourhoodId,
      description: input.notes.trim() || null,
      cadenceType: input.cadenceType,
      cadenceConfig: input.cadenceConfig,
      status: nextStatus,
      hidden: nextStatus === "archived",
      // Only stamped the moment a status is newly entered, not re-stamped on
      // every subsequent save while it stays in that state (that would keep
      // resetting the "weeks paused" badge / the true Finished date).
      ...(nextStatus === "paused" && prevStatus !== "paused" ? { pausedAt: today } : {}),
      ...(nextStatus !== "paused" ? { pausedAt: null } : {}),
      ...(nextStatus === "archived" && prevStatus !== "archived" ? { endDate: today } : {}),
      ...(nextStatus !== "archived" ? { endDate: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(activityInstances.id, activityInstanceId));

  const createdPeople: { tempId: string; id: string }[] = [];

  async function reconcile(entries: PersonInput[], role: "participant" | "facilitator") {
    const currentlyActive = await db
      .select({ personId: activityEnrollments.personId })
      .from(activityEnrollments)
      .where(and(eq(activityEnrollments.activityInstanceId, activityInstanceId), eq(activityEnrollments.role, role), eq(activityEnrollments.active, true)));
    const currentIds = new Set(currentlyActive.map((r) => r.personId));
    const desiredIds = new Set(entries.filter((e) => e.kind === "existing").map((e) => e.id));

    for (const personId of currentIds) {
      if (!desiredIds.has(personId)) {
        await db
          .update(activityEnrollments)
          .set({ active: false })
          .where(and(eq(activityEnrollments.activityInstanceId, activityInstanceId), eq(activityEnrollments.personId, personId)));
      }
    }

    for (const entry of entries) {
      if (entry.kind === "existing") {
        if (currentIds.has(entry.id)) continue;
        await db
          .insert(activityEnrollments)
          .values({ activityInstanceId, personId: entry.id, role })
          .onConflictDoUpdate({
            target: [activityEnrollments.activityInstanceId, activityEnrollments.personId],
            set: { role, active: true },
          });
      } else {
        const [created] = await db
          .insert(people)
          .values({ name: entry.name.trim(), personType: role === "facilitator" ? "adult" : "child", linkStatus: "pending", source: "quick_add" })
          .returning();
        await db.insert(activityEnrollments).values({ activityInstanceId, personId: created.id, role });
        if (entry.tempId) createdPeople.push({ tempId: entry.tempId, id: created.id });
      }
    }
  }

  await reconcile(input.facilitators, "facilitator");
  await reconcile(input.participants, "participant");

  return { createdPeople };
}

// Only ever called by Create Activity's Cancel button, to undo an activity
// that auto-save already created while the form was still open — a real
// hard delete (not the usual hidden+endDate soft-delete) since the row
// genuinely never should have existed. Cascades to its enrollments via the
// FK on activity_enrollments; doesn't touch any people it enrolled, quick-
// added or otherwise, since those are real person records independent of
// this one activity.
export async function deleteActivity(activityInstanceId: string) {
  await requireUserId();
  await db.delete(activityInstances).where(eq(activityInstances.id, activityInstanceId));
}
