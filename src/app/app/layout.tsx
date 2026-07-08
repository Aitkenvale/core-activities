import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { BottomTabBar } from "@/components/BottomTabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main style={{ flex: 1, padding: "32px 5% calc(var(--tabbar-height) + env(safe-area-inset-bottom) + 24px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <Link href="/app" style={{ display: "inline-block" }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.35rem", color: "var(--heading)" }}>
              Aitkenvale Core Activities
            </h1>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {/* SessionClient portals its lock-status pill in here when viewing a session; empty everywhere else. */}
            <div id="lock-status-slot" />
            <AccountMenu />
          </div>
        </div>

        {children}
      </main>
      <BottomTabBar />
    </>
  );
}
