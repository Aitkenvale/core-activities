"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PeopleSearch } from "@/app/app/people/PeopleSearch";
import { CloseButton } from "@/components/CloseButton";

// Mounted once, globally (see AppLayout) — never unmounted, just shown or
// hidden — so its search input already exists in the DOM the instant
// Search is tapped. That's the whole reason this exists rather than a
// normal page: iOS Safari only opens the on-screen keyboard for a focus()
// call made synchronously inside the tap's own event handler, on an
// element already present in the DOM. A route change can't satisfy that —
// the destination page's input doesn't exist yet at tap-time, and any
// focus() call after the transition completes (even in a mount effect)
// happens too late for iOS to treat it as caused by the tap.
//
// SearchButton calls `searchOverlay.open()` synchronously in its own
// onClick, before/alongside the actual navigation to /app/people (kept for
// a real, bookmarkable URL and working browser back/forward). This module-
// level object is how it reaches this component despite not being a
// parent/child of it in the tree.
export const searchOverlay = { open: () => {} };

export function SearchOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Plain DOM writes throughout this file rather than React state — no
  // part of show/hide needs a re-render, and for the tap-triggered open in
  // particular, a state update wouldn't commit until after the click
  // handler that triggered it returns, which is exactly the "too late for
  // iOS" case described above.
  function showAndFocus() {
    if (containerRef.current) containerRef.current.style.display = "flex";
    inputRef.current?.focus();
  }

  useEffect(() => {
    searchOverlay.open = showAndFocus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Covers every OTHER way of landing on /app/people — a direct link, a
  // bookmark, browser back/forward — where searchOverlay.open() was never
  // called. No guaranteed keyboard-open here (there was no tap for iOS to
  // credit), just correct visibility.
  useEffect(() => {
    if (containerRef.current) containerRef.current.style.display = pathname === "/app/people" ? "flex" : "none";
  }, [pathname]);

  function close() {
    if (containerRef.current) containerRef.current.style.display = "none";
    inputRef.current?.blur();
    router.back();
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: "none",
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--page-bg)",
        flexDirection: "column",
      }}
    >
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end", padding: "16px 5%" }}>
        <CloseButton onClick={close} />
      </div>
      {/* Always rendered, never conditionally mounted — the whole point is
          that this input already exists in the DOM before Search is ever
          tapped, so the very first tap's showAndFocus() has something real
          to call .focus() on. Only the outer container's display is what
          actually shows/hides this. */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", padding: "0 5% 24px" }}>
        <PeopleSearch ref={inputRef} />
      </div>
    </div>
  );
}
