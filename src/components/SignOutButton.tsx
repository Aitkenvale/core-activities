"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push("/sign-in");
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
