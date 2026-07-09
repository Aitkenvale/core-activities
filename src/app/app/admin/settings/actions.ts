"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema/appSettings";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
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
