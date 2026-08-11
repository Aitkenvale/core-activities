// Single source of truth for the home hub's L1 tiles — shared between the
// hub page itself and AppHeader (which uses the labels as L2 page titles),
// so the two can't drift out of sync. hiddenFromHub keeps an entry's label
// available for the page-title lookup without rendering a redundant tile
// for something already reachable from the footer tab bar.
export type NavTile = { href: string; label: string; adminOnly?: boolean; hiddenFromHub?: boolean };

export const USER_TILES: NavTile[] = [
  { href: "/app/activities", label: "Activities", hiddenFromHub: true },
  { href: "/app/cpp-training", label: "CPP Training", adminOnly: true },
  { href: "/app/qr", label: "Registration" },
];

// Admin-only — everything not listed here is a user function.
export const ADMIN_TILES: NavTile[] = [{ href: "/app/admin", label: "Admin Functions" }];
