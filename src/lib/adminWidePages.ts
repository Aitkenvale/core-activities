// Admin routes that are edited on a computer and need full desktop width
// plus the plain admin tab bar (no outer header) — Settings is included
// even though it's cards rather than a spreadsheet, since it's still an
// admin function edited on a computer. Only the bare "/app/admin" L2 tile
// menu is left out, since that's a normal mobile tile menu.
const ADMIN_WIDE_PREFIXES = ["/app/admin/people", "/app/admin/households", "/app/admin/activities", "/app/admin/settings"];

export function isAdminWidePage(pathname: string): boolean {
  return ADMIN_WIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
