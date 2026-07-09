"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";

const MAIN_TABS = [
  { href: "/app", label: "Home", icon: HomeIcon, match: (p: string) => p === "/app" },
  { href: "/app/attendance", label: "Attendance", icon: AttendanceIcon, match: (p: string) => p.startsWith("/app/attendance") },
  { href: "/app/people", label: "People", icon: PeopleIcon, match: (p: string) => p.startsWith("/app/people") },
  { href: "/app/activities", label: "Activities", icon: ActivityIcon, match: (p: string) => p.startsWith("/app/activities") },
];

// The admin data grids are full desktop width (see PhoneFrame) and have
// their own distinct set of destinations, so they get a separate tab set
// rather than the main app's Home/Attendance/People one.
const ADMIN_TABS = [
  { href: "/app", label: "Home", icon: HomeIcon, match: (p: string) => p === "/app" },
  { href: "/app/admin/people", label: "People", icon: PeopleIcon, match: (p: string) => p.startsWith("/app/admin/people") },
  { href: "/app/admin/households", label: "Households", icon: HouseholdIcon, match: (p: string) => p.startsWith("/app/admin/households") },
  { href: "/app/admin/activities", label: "Activities", icon: ActivityIcon, match: (p: string) => p.startsWith("/app/admin/activities") },
  { href: "/app/admin/attendance", label: "Attendance", icon: AttendanceIcon, match: (p: string) => p.startsWith("/app/admin/attendance") },
  { href: "/app/admin/settings", label: "Settings", icon: SettingsIcon, match: (p: string) => p.startsWith("/app/admin/settings") },
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

  if (!data?.user) return null;
  const tabs = pathname.startsWith("/app/admin/") ? ADMIN_TABS : MAIN_TABS;

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
      {tabs.map((tab) => {
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

// Three overlapping figures — distinct from the single-person People icon,
// for "Households" (a group, not an individual).
function HouseholdIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7.2" r="2.7" />
      <path d="M7.4 19.2c0-2.8 2.2-4.6 4.6-4.6s4.6 1.8 4.6 4.6" />
      <circle cx="4.8" cy="9.3" r="2.1" />
      <path d="M2 19.2c0-2.2 1.4-3.7 2.8-3.7" />
      <circle cx="19.2" cy="9.3" r="2.1" />
      <path d="M22 19.2c0-2.2-1.4-3.7-2.8-3.7" />
    </svg>
  );
}

// A plain calendar grid — distinct from the Attendance icon's checkmark,
// since this is about managing the activities/classes themselves, not
// marking a roll.
function ActivityIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="M8 14h2M14 14h2M8 17h2M14 17h2" />
    </svg>
  );
}

// A 6-lobed cog, evenly spaced every 60° around the center circle — the
// earlier hand-drawn version had uneven tooth spacing/size, so this uses
// the standard symmetric gear path instead.
function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
