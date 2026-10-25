const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The class ids a report download asks for ("id,id,id" in the link): each a real
// id, none repeated. null when there are none or any isn't an id, so a
// hand-edited link gets a plain "pick a class" answer rather than a database
// error. Shared by the reports that let you tick the classes to include.
export function parseActivityIds(raw: string | null): string[] | null {
  const ids = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0 || !ids.every((id) => UUID.test(id))) return null;
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}
