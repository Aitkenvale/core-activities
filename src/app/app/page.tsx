import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { USER_TILES, ADMIN_TILES } from "@/lib/navTiles";

const tileStyle = {
  display: "flex",
  alignItems: "center",
  minHeight: "var(--tap-min)",
  background: "var(--card-bg)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-5)",
  fontSize: "1.05rem",
  color: "var(--text)",
};

export default async function AppHome() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isAdmin = session?.user?.role === "admin";
  const userTiles = USER_TILES.filter((t) => !t.hiddenFromHub && (!t.adminOnly || isAdmin));

  return (
    // Bleeds past <main>'s 5% side padding so the backdrop reaches the true
    // edges, then re-adds that same padding inside for the tile grid. Only
    // this page carries the image — the shared layout/header stay plain.
    <div
      style={{
        margin: "0 -5%",
        padding: "var(--space-5) 5% 24px",
        minHeight: "calc(100dvh - var(--app-header-height))",
        backgroundImage: "url('/home-tree-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        {userTiles.map((tile) => (
          <Link key={tile.href} href={tile.href} style={tileStyle}>
            {/* The QR tile is one link for now (text + icon) — each half
                gets its own destination once the registration form and
                QR share flow are actually built. */}
            {tile.href === "/app/qr" ? (
              <>
                <span style={{ flex: 1 }}>{tile.label}</span>
                <QrIcon />
              </>
            ) : (
              tile.label
            )}
          </Link>
        ))}
      </div>

      {isAdmin && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "var(--space-6) 0" }} />
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {ADMIN_TILES.map((tile) => (
              <Link key={tile.href} href={tile.href} style={tileStyle}>
                {tile.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="3" height="3" rx="0.5" />
      <rect x="18" y="14" width="3" height="3" rx="0.5" />
      <rect x="14" y="18" width="3" height="3" rx="0.5" />
      <rect x="18" y="18" width="3" height="3" rx="0.5" />
    </svg>
  );
}
