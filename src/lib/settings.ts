import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema/appSettings";

// Server-only helpers for admin-configurable settings (src/app/app/admin/settings).
// Falls back to a sensible default if a row is ever missing (e.g. a fresh
// environment before the seed script has run) rather than throwing.

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  return row?.value ?? fallback;
}

export async function getEditWindowMonths(): Promise<number> {
  const value = await getSetting("non_admin_edit_window_months", "3");
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

// Instance-wide override — when on, every visitor gets dark mode
// regardless of their own device's light/dark setting (see the root
// layout, which reads this and stamps data-theme="dark" on <html>).
export async function getEnforceDarkMode(): Promise<boolean> {
  const value = await getSetting("enforce_dark_mode", "false");
  return value === "true";
}
