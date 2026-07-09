// A person's record is "complete" once it has enough to actually be useful —
// DOB (even a placeholder like 01-01-YYYY counts, it just needs to be
// present so category/age can compute) and a household. Not about whether
// the record has been reconciled with a duplicate (that's linkStatus,
// still used separately for the merge flow) — this is purely "is anything
// missing," shown as "Add Info" in both People and Attendance.
export function isPersonInfoComplete(dob: string | null, householdId: string | null): boolean {
  return Boolean(dob) && Boolean(householdId);
}
