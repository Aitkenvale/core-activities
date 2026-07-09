// Mirrors the old sheet's formula exactly:
// =LOOKUP(age, {0,5,9,12,15,25}, {"1. Infant","2. Young Child","3. Older Child","4. Junior Youth","5. Youth","6. Adult"})
// Always computed live from DOB, never stored — a stored value would go
// stale the moment a birthday passes.
const BREAKPOINTS = [0, 5, 9, 12, 15, 25];
const LABELS = ["1. Infant", "2. Young Child", "3. Older Child", "4. Junior Youth", "5. Youth", "6. Adult"];
export const CATEGORY_LABELS = LABELS;

// Too young to run a class — excluded from facilitator pickers (search
// results and filter pills alike), not just Adult-only-by-convention.
export const FACILITATOR_INELIGIBLE_CATEGORIES = ["1. Infant", "2. Young Child", "3. Older Child"];

// Too young for any structured class at all — participant classes start at
// Young Child.
export const PARTICIPANT_INELIGIBLE_CATEGORIES = ["1. Infant"];

// The leading "N. " exists so LABELS sorts and looks up in age order — it's
// an implementation detail, not something anyone needs to see on a pill.
export function formatCategoryLabel(label: string): string {
  return label.replace(/^\d+\.\s*/, "");
}

export function calculateAge(dob: string): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export function getCategoryLabel(dob: string | null): string | null {
  if (!dob) return null;
  const age = calculateAge(dob);
  let label = LABELS[0];
  for (let i = 0; i < BREAKPOINTS.length; i++) {
    if (age >= BREAKPOINTS[i]) label = LABELS[i];
  }
  return label;
}
