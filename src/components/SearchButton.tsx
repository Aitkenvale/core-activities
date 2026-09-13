"use client";

import Link from "next/link";
import { searchOverlay } from "@/components/SearchOverlay";

// Same circular button treatment as AccountMenu — this is what fills the
// header's top-right slot on Attendance/Events/Activities (and sits to the
// login icon's left on Home) now that finding a person is reached from
// here instead of a dedicated bottom tab.
export function SearchButton() {
  return (
    <Link
      href="/app/people"
      aria-label="Search People"
      // Synchronous, right inside this tap's own event handler — see
      // SearchOverlay for why that's what actually gets iOS to open the
      // keyboard, not just show the search page.
      onClick={() => searchOverlay.open()}
      style={{
        flexShrink: 0,
        width: "var(--tap-min)",
        height: "var(--tap-min)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        color: "var(--muted)",
      }}
    >
      <SearchIcon />
    </Link>
  );
}

function SearchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.35-4.35" />
    </svg>
  );
}
