import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";

const USER_TILES = [
  { href: "/app/attendance", label: "Update Attendance" },
  { href: "/app/activities", label: "Create New Activity" },
  { href: "/app/people", label: "Find Person" },
  { href: "/app/cpp-training", label: "CPP Training" },
  { href: "/app/qr", label: "Share Registration QR Code" },
];

// Admin-only — everything not listed here is a user function.
const ADMIN_TILES = [{ href: "/app/admin", label: "Admin Functions" }];

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

  return (
    <>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        {USER_TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} style={tileStyle}>
            {tile.label}
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
    </>
  );
}
