"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema/appSettings";
import { allowedSignups } from "@/db/schema/allowedSignups";
import { user } from "@/db/schema/auth";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
  return session;
}

export async function updateEditWindowMonths(months: number) {
  await requireAdmin();
  if (!Number.isFinite(months) || months < 1) throw new Error("Must be at least 1 month");
  await db
    .insert(appSettings)
    .values({ key: "non_admin_edit_window_months", value: String(months) })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: String(months), updatedAt: new Date() },
    });
}

export async function updateEnforceDarkMode(enabled: boolean) {
  await requireAdmin();
  await db
    .insert(appSettings)
    .values({ key: "enforce_dark_mode", value: String(enabled) })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: String(enabled), updatedAt: new Date() },
    });
}

export async function updateUserRole(userId: string, role: "admin" | "facilitator") {
  const session = await requireAdmin();
  if (userId === session.user.id && role !== "admin") {
    throw new Error("You can't remove your own admin role.");
  }
  await db.update(user).set({ role }).where(eq(user.id, userId));
}

// The account name comes from what the admin set when adding the person to
// Settings > Users, not what they typed at sign-up (see auth.ts) — this is
// how to fix it if that name was wrong or needs updating later.
export async function updateUserName(userId: string, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  await db.update(user).set({ name: trimmed }).where(eq(user.id, userId));
}

export async function addAllowedSignup(name: string, email: string, isAdmin: boolean) {
  await requireAdmin();
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (!trimmedName || !normalizedEmail) throw new Error("Name and email are required");
  const [created] = await db
    .insert(allowedSignups)
    .values({ name: trimmedName, email: normalizedEmail, isAdmin })
    .onConflictDoNothing({ target: allowedSignups.email })
    .returning();
  if (!created) throw new Error("That email has already been added.");
  return created;
}

export async function removeAllowedSignup(id: string) {
  await requireAdmin();
  await db.delete(allowedSignups).where(eq(allowedSignups.id, id));
}
