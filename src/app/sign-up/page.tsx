"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    setPending(true);
    const { error } = await authClient.passkey.addPasskey({
      name: "Primary passkey",
      context: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    setPending(false);
    if (error) {
      setError(error.message ?? "Sign-up failed. Try again.");
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
        gap: 12,
        padding: "40px 16px",
        maxWidth: 360,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", color: "var(--deep)" }}>
        Create Account
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.8rem", textAlign: "center" }}>
        Only pre-authorized emails can create an account.
      </p>
      <input
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 2 }}
      />
      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 2 }}
      />
      <button
        onClick={handleSignUp}
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
          width: "100%",
        }}
      >
        {pending ? "Creating…" : "Create passkey"}
      </button>
      {error && <p style={{ color: "var(--red)", fontSize: "0.85rem" }}>{error}</p>}
    </main>
  );
}
