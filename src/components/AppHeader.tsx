"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { BackButton } from "@/components/BackButton";
import { isAdminWidePage } from "@/lib/adminWidePages";
import { getPageTitle } from "@/lib/pageTitle";

// The admin data grids need the vertical space for the spreadsheet — this
// header (title, back button, account menu) would just be redundant there,
// so it hides itself on those routes only.
export function AppHeader() {
  const pathname = usePathname();
  if (isAdminWidePage(pathname)) return null;
  const title = getPageTitle(pathname);

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
            bigger. */}
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", lineHeight: 1, color: "var(--text)" }}>
          {title}
        </h1>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        {/* SessionClient portals its lock-status pill in here when viewing a session; empty everywhere else. */}
        <div id="lock-status-slot" />
        <AccountMenu />
      </div>
    </div>
  );
}
