"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setError(null);
    setPending(true);
    const { error } = await authClient.signIn.passkey();
    setPending(false);
    if (error) {
      setError(error.message ?? "Sign-in failed. Try again.");
      return;
    }
    router.push("/app");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "40px 16px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", color: "var(--deep)" }}>
        Sign In
      </h1>
      <button
        onClick={handleSignIn}
        disabled={pending}
        style={{
          background: "var(--deep)",
          color: "var(--cream)",
          padding: "12px 28px",
          borderRadius: 2,
          fontSize: "0.85rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          border: "none",
          cursor: "pointer",
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
