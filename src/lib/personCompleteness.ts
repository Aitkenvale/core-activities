// A person's record is "complete" once it has enough to actually be useful:
// DOB (even a placeholder like 01-01-YYYY counts, it just needs to be
// present so category/age can compute), a household, that household having
// a designated contact person, and that contact having a mobile number on
// file — so someone's actually reachable on this person's behalf. Not about
// whether the record has been reconciled with a duplicate (that's
// linkStatus, still used separately for the merge flow) — this is purely
// "is anything essential missing," shown as "Add Info" in Attendance.
export function isPersonInfoComplete(
  dob: string | null,
  householdId: string | null,
  householdContactPersonId: string | null,
  householdContactMobile: string | null,
): boolean {
  return Boolean(dob) && Boolean(householdId) && Boolean(householdContactPersonId) && Boolean(householdContactMobile);
}
