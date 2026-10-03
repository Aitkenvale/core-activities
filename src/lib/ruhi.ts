// Ruhi Camps — the one activity category with a per-participant study log
// (books x units) and a fixed ad-hoc cadence. Pure constants and helpers
// only, safe to import from client components; the database side lives in
// ruhiProgress.ts, which must stay server-only.
import type { CadenceType } from "@/lib/cadence";

export const RUHI_CATEGORY_ID = "ruhi";

export const RUHI_BOOK_COUNT = 14;
export const RUHI_UNITS_PER_BOOK = 3;
export const RUHI_BOOKS = Array.from({ length: RUHI_BOOK_COUNT }, (_, i) => i + 1);
export const RUHI_UNITS = Array.from({ length: RUHI_UNITS_PER_BOOK }, (_, i) => i + 1);

// "none" (not studied) is the in-app name for the absence of a stored row.
export type RuhiUnitStatus = "none" | "partial" | "complete";
export type StoredRuhiUnitStatus = Exclude<RuhiUnitStatus, "none">;

export function isRuhiUnitStatus(value: unknown): value is RuhiUnitStatus {
  return value === "none" || value === "partial" || value === "complete";
}

// Tapping cycles — not studied, then partly, then completed, then back to
// not studied.
export function nextRuhiStatus(status: RuhiUnitStatus): RuhiUnitStatus {
  if (status === "none") return "partial";
  if (status === "partial") return "complete";
  return "none";
}

export function ruhiCellKey(personId: string, book: number, unit: number): string {
  return `${personId}:${book}:${unit}`;
}

export function assertValidRuhiCell(book: number, unit: number) {
  if (!Number.isInteger(book) || book < 1 || book > RUHI_BOOK_COUNT) throw new Error("Invalid book.");
  if (!Number.isInteger(unit) || unit < 1 || unit > RUHI_UNITS_PER_BOOK) throw new Error("Invalid unit.");
}

export function isRuhiCategory(categoryId: string): boolean {
  return categoryId === RUHI_CATEGORY_ID;
}

// Ruhi Camps are only ever ad-hoc (each date is chosen when taking
// attendance, never generated from a pattern) — the one category whose
// cadence isn't the activity's own choice. Used by both the Create/Edit
// Activity form (to grey the other options) and the server actions (so a
// stale form, or switching an existing activity's category, can't leave a
// weekly cadence behind).
export function lockedCadenceTypeFor(categoryId: string): CadenceType | undefined {
  return isRuhiCategory(categoryId) ? "ad_hoc" : undefined;
}
