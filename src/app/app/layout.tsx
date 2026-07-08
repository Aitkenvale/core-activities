import { AppHeader } from "@/components/AppHeader";
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
        <AppHeader />
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
