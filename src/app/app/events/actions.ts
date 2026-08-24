"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { events } from "@/db/schema/events";

// Any signed-in user, not admin-only — Events is reachable from the main
// tab bar everyone shares, and keeping the community calendar current is a
// facilitator-level task, not a spreadsheet-level one.
async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in");
}

export async function createEvent(date: string, description: string) {
  await requireSession();
  const trimmed = description.trim();
  if (!date) throw new Error("Date is required");
  if (!trimmed) throw new Error("Description is required");
  const [created] = await db.insert(events).values({ date, description: trimmed }).returning();
  return created;
}

export async function updateEvent(id: string, date: string, description: string) {
  await requireSession();
  const trimmed = description.trim();
  if (!date) throw new Error("Date is required");
  if (!trimmed) throw new Error("Description is required");
  await db.update(events).set({ date, description: trimmed, updatedAt: new Date() }).where(eq(events.id, id));
}

// A real delete, not the app's usual soft-hide — nothing else references
// an event row, so there's no history a soft-delete would need to protect.
export async function deleteEvent(id: string) {
  await requireSession();
  await db.delete(events).where(eq(events.id, id));
}
