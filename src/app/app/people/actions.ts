"use server";

import { headers } from "next/headers";
import { and, eq, ilike, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";

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
  return db
    .select({
      id: people.id,
      name: people.name,
      preferredName: people.preferredName,
      householdId: people.householdId,
      householdName: households.name,
      householdAddress: households.address,
      mobile: people.mobile,
      comment: people.comment,
    })
    .from(people)
    .leftJoin(households, eq(households.id, people.householdId))
    .where(
      and(
        eq(people.hidden, false),
        or(ilike(people.name, `%${q}%`), ilike(people.preferredName, `%${q}%`), ilike(households.name, `%${q}%`)),
      ),
    )
    .limit(20);
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

export async function updatePersonNotes(id: string, comment: string) {
  await requireAdmin();
  await db.update(people).set({ comment: comment.trim() || null }).where(eq(people.id, id));
}

export async function updateHouseholdAddress(householdId: string, address: string) {
  await requireAdmin();
  await db.update(households).set({ address: address.trim() || null }).where(eq(households.id, householdId));
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
