import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

const ADMIN_TILES = [
  { href: "/app/admin/people", label: "Edit All People" },
  { href: "/app/admin/households", label: "Edit Households" },
  { href: "/app/admin/activities", label: "Edit Activities" },
  { href: "/app/admin/attendance", label: "Edit Attendance" },
  { href: "/app/admin/settings", label: "Settings" },
];

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

export default async function AdminMenuPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  return (
    <>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-6)" }}>
        Admin Functions
      </h2>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        {ADMIN_TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} style={tileStyle}>
            {tile.label}
          </Link>
        ))}
      </div>
    </>
  );
}
