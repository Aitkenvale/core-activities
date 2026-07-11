import { USER_TILES, ADMIN_TILES } from "./navTiles";

// Longest href first, so a more specific tile wins if hrefs ever nest.
const ALL_TILES = [...USER_TILES, ...ADMIN_TILES].sort((a, b) => b.href.length - a.href.length);

// The sticky top bar shows the app name only on Home itself — every L2
// section (and anything nested under it) shows its own tile's label
// instead, so the bar reads as "where you are" rather than static branding.
export function getPageTitle(pathname: string): string {
  if (pathname === "/app") return "Aitkenvale";
  // More specific than the "Activities" tile below — the create/edit forms
  // get their own title rather than the generic section name.
  if (pathname.startsWith("/app/activities/create")) return "Create Activity";
  if (pathname.startsWith("/app/activities/edit")) return "Edit Activity";
  // The Activities list itself reads "Aitkenvale" like every other section —
  // it was the only tile whose href actually matched a real, visited route
  // here (People/Attendance/Households aren't tiles at all), so it was the
  // only page that ever fell through to its own label instead of the
  // "Aitkenvale" fallback everyone else already gets.
  if (pathname.startsWith("/app/activities")) return "Aitkenvale";
  return ALL_TILES.find((t) => pathname.startsWith(t.href))?.label ?? "Aitkenvale";
}
