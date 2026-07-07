import Link from "next/link";
import { SwipeBack } from "@/components/SwipeBack";
import { SignOutButton } from "@/components/SignOutButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SwipeBack />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
        <Link href="/app" style={{ display: "inline-block", marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.05rem", color: "var(--deep)" }}>
            Aitkenvale Core Activities
          </h1>
        </Link>

        {children}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
          <SignOutButton />
        </div>
      </main>
    </>
  );
}
