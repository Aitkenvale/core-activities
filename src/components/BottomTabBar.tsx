"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";

const TABS = [
  { href: "/app", label: "Home", icon: HomeIcon, match: (p: string) => p === "/app" },
  { href: "/app/attendance", label: "Attendance", icon: AttendanceIcon, match: (p: string) => p.startsWith("/app/attendance") },
  { href: "/app/people", label: "People", icon: PeopleIcon, match: (p: string) => p.startsWith("/app/people") },
];

// A persistent bottom tab bar for the app's primary sections, per Apple HIG's
// tab bar pattern — replaces relying on the top title bar + swipe-back alone
// for getting around. Deliberately NOT position:fixed/sticky — iOS (especially
// standalone/home-screen mode) can let fixed elements visually detach and
// scroll with the page. Instead this is just a plain last flex child inside
// AppLayout's non-scrolling shell, so it never needs "fixed" to stay put.
export function BottomTabBar() {
  const pathname = usePathname();
  const { data } = useSession();

  // Admin grids are deliberately full desktop width (see PhoneFrame), where a
  // mobile-style tab bar would look out of place.
  if (pathname.startsWith("/app/admin")) return null;
  if (!data?.user) return null;

  return (
    <nav
      style={{
        flexShrink: 0,
        display: "flex",
        background: "var(--card-bg)",
        borderTop: "1px solid var(--border)",
        boxShadow: "var(--shadow-elevated)",
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 40,
      }}
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              minHeight: "var(--tap-min)",
              padding: "8px 4px 10px",
              color: active ? "var(--heading)" : "var(--muted)",
            }}
          >
            <Icon active={active} />
            <span style={{ fontSize: "0.68rem", letterSpacing: "0.02em" }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function AttendanceIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="m9 14.5 2 2 4-4.5" />
    </svg>
  );
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.13-6 7-6s7 2.4 7 6" />
    </svg>
  );
}
