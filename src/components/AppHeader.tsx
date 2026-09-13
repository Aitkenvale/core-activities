"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { BackButton, getParentPath } from "@/components/BackButton";
import { SearchButton } from "@/components/SearchButton";
import { CloseButton } from "@/components/CloseButton";
import { isAdminWidePage } from "@/lib/adminWidePages";
import { getPageTitle } from "@/lib/pageTitle";

// The admin data grids need the vertical space for the spreadsheet — this
// header (title, back button, account menu) would just be redundant there,
// so it hides itself on those routes only.
export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  if (isAdminWidePage(pathname)) return null;
  const title = getPageTitle(pathname);

  // The login icon is only needed on Home — everywhere else its top-right
  // slot now does something more useful: a Search icon (into People) on
  // the three list pages, or an explicit Close on a page reached by
  // drilling in (an Activity/Attendance sub-page, or People itself).
  const isHome = pathname === "/app";
  const isListPage = pathname === "/app/attendance" || pathname === "/app/events" || pathname === "/app/activities";
  const isPeoplePage = pathname === "/app/people";
  const isActivityOrAttendanceSubpage = (pathname.startsWith("/app/activities") || pathname.startsWith("/app/attendance")) && !isListPage;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--page-bg)",
        minHeight: "var(--app-header-height)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 0",
      }}
    >
      {/* Absolutely positioned — an overlay tap zone, not a flex sibling,
          so it doesn't push the title rightward out of alignment. */}
      <BackButton />
      <Link href="/app" style={{ display: "inline-block" }}>
        {/* lineHeight:1 keeps the taller glyphs from growing the line box —
            the header's own minHeight/padding is what other pages assume
            is its fixed rendered height (--app-header-height), so this
            can't grow the header even though the text itself now reads
            bigger. The "Community Education" subtitle is small enough that
            both lines together still fit inside that same fixed height. */}
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", lineHeight: 1, color: "var(--text)" }}>
          {title}
        </h1>
        {title === "Aitkenvale" && (
          <span style={{ display: "block", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginTop: 2, lineHeight: 1 }}>
            Community Education
          </span>
        )}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        {/* SessionClient portals its lock-status pill in here when viewing a session; empty everywhere else. */}
        <div id="lock-status-slot" />
        {(isHome || isListPage) && <SearchButton />}
        {isHome && <AccountMenu />}
        {isPeoplePage && <CloseButton onClick={() => router.back()} />}
        {isActivityOrAttendanceSubpage && <CloseButton onClick={() => router.push(getParentPath(pathname) ?? "/app")} />}
      </div>
    </div>
  );
}
