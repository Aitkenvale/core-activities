// Ruhi Camps — the one activity category whose cadence is fixed (always
// ad-hoc). Their study log, like the Children's Grades and Junior Youth Texts
// logs, is described in studyTracks.ts. Pure constants and helpers only, safe
// to import from client components.
import type { CadenceType } from "@/lib/cadence";

export const RUHI_CATEGORY_ID = "ruhi";

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
