import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { BackButton } from "@/components/BackButton";
import { BottomTabBar } from "@/components/BottomTabBar";

// iOS (especially standalone/home-screen mode) is unreliable about keeping
// position:fixed truly pinned during scroll — it can visually detach and
// appear to scroll with the page. Sidestep that whole class of bug: lock
// this shell to the viewport height with overflow hidden, let only <main>
// scroll internally, and let the tab bar sit as a plain last flex child
// that never needs "fixed" at all because the shell around it never moves.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", padding: "0 5% 24px" }}>
        {/* No horizontal padding of its own — sitting inside <main>'s padded
            box keeps it aligned with every page's own content (e.g. the
            admin tables) at exactly the same left/right edges. Sticky so it
            reaches the true top of the screen once scrolling starts, same
            token height as the inner grid sticky bars stack under. */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "var(--page-bg)",
            minHeight: "var(--app-header-height)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 0",
          }}
        >
          {/* Absolutely positioned — an overlay tap zone, not a flex sibling,
              so it doesn't push the title rightward out of alignment. */}
          <BackButton />
          <Link href="/app" style={{ display: "inline-block" }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.35rem", color: "var(--heading)" }}>
              Core Activities
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
    </div>
  );
}
