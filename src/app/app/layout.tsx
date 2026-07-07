import Link from "next/link";
import { SwipeBack } from "@/components/SwipeBack";
import { ConditionalSignOut } from "@/components/ConditionalSignOut";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SwipeBack />
      <main style={{ padding: "40px 5%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <Link href="/app" style={{ display: "inline-block" }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.05rem", color: "var(--deep)" }}>
              Aitkenvale Core Activities
            </h1>
          </Link>
          {/* SessionClient portals its lock-status pill in here when viewing a session; empty everywhere else. */}
          <div id="lock-status-slot" />
        </div>

        {children}

        <ConditionalSignOut />
      </main>
    </>
  );
}
