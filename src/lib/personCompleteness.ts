import { calculateAge } from "@/lib/category";

// Shown as a traffic-light face icon in Attendance: full details normally
// come through a completed Registration form, but there are plenty of other
// ways to pick up some of them first (a quick-add during a session, a call
// from a parent) — rego (formal permission) is still separately required
// regardless of how much informal detail is already on file. Under-15s get
// a stricter three-level check (an emergency contact is non-negotiable);
// 15+ only needs a household and a way to reach someone.
export type CompletenessLevel = "green" | "yellow" | "red";

export function getPersonCompletenessLevel(params: {
  dob: string | null;
  mobile: string | null;
  householdId: string | null;
  householdContactPersonId: string | null;
  householdContactMobile: string | null;
  regoYear: number | null;
  regoFormUrl: string | null;
}): CompletenessLevel {
  // DOB missing entirely means age can't be computed — default to the
  // stricter under-15 bracket rather than assume they're old enough to
  // need less.
  const isYouthOrAdult = params.dob !== null && calculateAge(params.dob) >= 15;

  if (isYouthOrAdult) {
    const hasHousehold = Boolean(params.householdId);
    const reachableSomehow = Boolean(params.mobile) || Boolean(params.householdContactMobile);
    return hasHousehold && reachableSomehow ? "green" : "yellow";
  }

  // Priority 1 (most urgent): someone must be reachable in an emergency —
  // no contact, or no way to reach them, is the worst state regardless of
  // anything else on file.
  const hasContactAndMobile = Boolean(params.householdContactPersonId) && Boolean(params.householdContactMobile);
  if (!hasContactAndMobile) return "red";

  // Priority 2: the formal Registration form plus DOB and household —
  // everything else needed on top of a reachable contact. A linked form is
  // the real signal now that forms actually get scanned/linked; a recorded
  // rego year with no linked form still counts as a backup (an admin noted
  // it before the form itself was ever uploaded), just not the preferred one.
  const hasRego = Boolean(params.regoFormUrl) || Boolean(params.regoYear);
  const hasFullRego = hasRego && Boolean(params.dob) && Boolean(params.householdId);
  return hasFullRego ? "green" : "yellow";
}
