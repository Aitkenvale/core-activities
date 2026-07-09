"use server";

import { headers } from "next/headers";
import { and, eq, ilike, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { getCategoryLabel } from "@/lib/category";
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
export async function searchPeopleForPicker(query: string, categories: string[]) {
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
    .orderBy(people.name)
    .limit(100);

  const filtered = categories.length > 0 ? rows.filter((r) => categories.includes(getCategoryLabel(r.dob) ?? "")) : rows;
  return filtered.slice(0, 30).map(({ id, name, preferredName, linkStatus }) => ({ id, name, preferredName, linkStatus }));
}

type PersonInput =
  | { kind: "existing"; id: string }
  | { kind: "new"; name: string };

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

  async function enroll(entries: PersonInput[], role: "participant" | "facilitator") {
    for (const entry of entries) {
      const personId =
        entry.kind === "existing"
          ? entry.id
          : (
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
      await db.insert(activityEnrollments).values({ activityInstanceId: activity.id, personId, role });
    }
  }

  await enroll(input.facilitators, "facilitator");
  await enroll(input.participants, "participant");

  return activity;
}
