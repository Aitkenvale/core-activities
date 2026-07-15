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
    <>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        {userTiles.map((tile) =>
          tile.href === "/app/qr" ? (
            // Two destinations sharing one card: the label starts the
            // registration process directly on this device, the QR icon
            // shows a code for a *different* phone to scan instead.
            <div key={tile.href} style={{ ...tileStyle, padding: 0 }}>
              <Link href="/register" style={{ flex: 1, minHeight: "var(--tap-min)", display: "flex", alignItems: "center", padding: "0 var(--space-5)", color: "var(--text)" }}>
                {tile.label}
              </Link>
              <Link
                href="/app/qr"
                aria-label="Show QR code to scan"
                style={{ display: "flex", alignItems: "center", minHeight: "var(--tap-min)", padding: "0 var(--space-5)", color: "var(--text)", borderLeft: "1px solid var(--border)" }}
              >
                <QrIcon />
              </Link>
            </div>
          ) : (
            <Link key={tile.href} href={tile.href} style={tileStyle}>
              {tile.label}
            </Link>
          ),
        )}
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

      {/* Purely decorative — sits below every tile (including Admin
          Functions), never behind/under the buttons themselves. */}
      <img
        src="/home-tree.png"
        alt=""
        style={{ display: "block", width: "70%", maxWidth: 280, margin: "var(--space-7) auto 0" }}
      />
    </>
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
