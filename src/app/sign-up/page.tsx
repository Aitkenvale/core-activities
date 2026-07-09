"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setPending(true);
    const { error } = await authClient.passkey.addPasskey({
      name: "Primary passkey",
      context: JSON.stringify({ email: email.trim() }),
    });
    if (error) {
      setPending(false);
      setError(error.message ?? "Sign-up failed. Try again.");
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
        gap: 12,
        padding: "40px 16px",
        maxWidth: 360,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", color: "var(--heading)" }}>
        Create Account
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.8rem", textAlign: "center" }}>
        Only pre-authorized emails can create an account. Your name will be
        set by whoever authorized you — ask them to fix it in Settings if
        it's wrong.
      </p>
      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", fontSize: 16, minHeight: "var(--tap-min)", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
      />
      <button
        onClick={handleSignUp}
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
        }}
      >
        {pending ? "Creating…" : "Create passkey"}
      </button>
      {error && <p style={{ color: "var(--red)", fontSize: "0.85rem" }}>{error}</p>}
    </main>
  );
}
