import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";

const TILES = [
  { href: "/app/attendance", label: "Update Attendance", adminOnly: false },
  { href: "/app/activities", label: "Create New Activity", adminOnly: false },
  { href: "/app/people", label: "Find Person", adminOnly: false },
  { href: "/app/cpp-training", label: "CPP Training", adminOnly: false },
  { href: "/app/qr", label: "Share Registration QR Code", adminOnly: false },
  { href: "/app/admin", label: "Admin", adminOnly: true },
];

export default async function AppHome() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;

  const tiles = TILES.filter((tile) => !tile.adminOnly || user?.role === "admin");

  return (
    <>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 16 }}>
        Logged in as {user?.name} ({user?.role})
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            style={{
              display: "block",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 20,
              fontSize: "0.95rem",
              color: "var(--text)",
            }}
          >
            {tile.label}
          </Link>
        ))}
      </div>
    </>
  );
}
