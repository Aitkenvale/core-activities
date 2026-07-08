"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setError(null);
    setPending(true);
    const { error } = await authClient.signIn.passkey();
    if (error) {
      setPending(false);
      setError(error.message ?? "Sign-in failed. Try again.");
      return;
    }
    // Full page navigation (not router.push) so the fresh session cookie
    // is guaranteed to be picked up rather than a stale cached /app redirect.
    window.location.href = "/app";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "40px 16px",
        maxWidth: 360,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", color: "var(--heading)" }}>
        Sign In
      </h1>
      <button
        onClick={handleSignIn}
        disabled={pending}
        style={{
          minHeight: "var(--tap-min)",
          background: "var(--deep)",
          color: "var(--cream)",
          padding: "0 28px",
          borderRadius: "var(--radius-pill)",
          fontSize: "0.85rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          border: "none",
          cursor: "pointer",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {pending ? "Signing in…" : "Sign in with passkey"}
      </button>
      {error && <p style={{ color: "var(--red)", fontSize: "0.85rem" }}>{error}</p>}
      <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
        First time? <Link href="/sign-up">Create an account</Link>
      </p>
    </main>
  );
}
