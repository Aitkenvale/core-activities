// Admin routes that are real spreadsheets and need full desktop width plus
// the plain admin tab bar (no outer header) — everything else under
// /app/admin (the L2 tile menu, Settings) is a normal mobile-width, card-based
// page and keeps the outer header + phone frame like the rest of the app.
const ADMIN_WIDE_PREFIXES = ["/app/admin/people", "/app/admin/households", "/app/admin/activities"];

export function isAdminWidePage(pathname: string): boolean {
  return ADMIN_WIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
