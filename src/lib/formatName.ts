// Search-result lists (linking a pending person, adding someone existing,
// the main Find Person search) show both names — the formal name is what
// matches official records, the AKA alone isn't enough to tell people who
// share a nickname or first name apart.
export function formatFullName(name: string, preferredName: string | null): string {
  return preferredName ? `${name} (${preferredName})` : name;
}
