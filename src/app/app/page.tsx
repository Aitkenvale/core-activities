import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { getOrCreateAppUser } from "@/lib/auth";

const TILES = [
  { href: "/app/attendance", label: "Edit Attendance", adminOnly: false },
  { href: "/app/activities", label: "Create New Activity", adminOnly: true },
  { href: "/app/people", label: "Update People Details", adminOnly: true },
  { href: "/app/cpp-training", label: "CPP Training", adminOnly: false },
  { href: "/app/qr", label: "Share Registration QR Code", adminOnly: false },
];

export default async function AppHome() {
  const appUser = await getOrCreateAppUser();

  const tiles = TILES.filter((tile) => !tile.adminOnly || appUser?.role === "admin");

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", color: "var(--deep)" }}>
            Aitkenvale Program Tracker
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            Logged in as {appUser?.name} ({appUser?.role})
          </p>
        </div>
        <UserButton />
      </div>

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
    </main>
  );
}
