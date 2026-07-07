// Builds a display label for a household from its guardians' first names.
// Editable by an admin afterward — this is just the default at creation time.
export function buildHouseholdName(guardianFirstNames: string[]): string {
  const names = guardianFirstNames.map((n) => n.trim()).filter(Boolean);

  if (names.length === 0) return "Household";
  if (names.length === 1) return `${names[0]} household`;
  if (names.length === 2) return `${names[0]}—${names[1]} household`;

  const last = names[names.length - 1];
  const rest = names.slice(0, -1);
  return `${rest.join(", ")} & ${last} household`;
}
