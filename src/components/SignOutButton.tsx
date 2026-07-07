"use client";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        // Full page navigation so no stale cached /app content can show.
        window.location.href = "/sign-in";
      }}
      style={{
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 2,
        padding: "8px 16px",
        fontSize: "0.8rem",
        color: "var(--muted)",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
