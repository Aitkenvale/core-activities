"use client";

import { useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";

// Top-right account icon (same row as the app title) — replaces the old
// "Logged in as..." text on the Home page and the separate bottom-right
// sign-out button with a single menu reachable from anywhere in the app.
export function AccountMenu() {
  const { data } = useSession();
  const [open, setOpen] = useState(false);

  if (!data?.user) return null;

  async function handleSignOut() {
    await signOut();
    // Full page navigation so no stale cached /app content can show.
    window.location.href = "/sign-in";
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
        style={{
          width: "var(--tap-min)",
          height: "var(--tap-min)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--border)",
          background: open ? "var(--deep)" : "var(--card-bg)",
          color: open ? "var(--cream)" : "var(--muted)",
          cursor: "pointer",
        }}
      >
        <PersonIcon />
      </button>

      {open && (
        <>
          {/* Full-screen invisible backdrop to close the menu on outside tap. */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 45 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              zIndex: 50,
              minWidth: 220,
              background: "var(--card-bg)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-elevated)",
              padding: "var(--space-4)",
            }}
          >
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "var(--space-4)" }}>
              Logged in as {data.user.name} ({(data.user as { role?: string }).role})
            </p>
            <button
              onClick={handleSignOut}
              style={{
                width: "100%",
                minHeight: "var(--tap-min)",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.13-6 7-6s7 2.4 7 6" />
    </svg>
  );
}
