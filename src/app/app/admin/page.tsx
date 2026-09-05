import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

const ADMIN_TILES = [
  { href: "/app/admin/people", label: "Edit All People" },
  { href: "/app/admin/households", label: "Edit Households" },
  { href: "/app/admin/activities", label: "Edit Activities" },
  { href: "/app/admin/roles", label: "Teacher / Co-Teacher Roles" },
  { href: "/app/admin/attendance", label: "Edit Attendance" },
  { href: "/app/admin/attendance-records", label: "Attendance Records" },
  { href: "/app/admin/school-attendance", label: "School Attendance" },
  { href: "/app/admin/family-report", label: "Family Report" },
  { href: "/app/admin/registrations", label: "Registrations" },
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
      {/* No body heading — AppHeader's sticky title already shows "Admin
          Functions" for this route (src/lib/pageTitle.ts). */}
      <div style={{ display: "grid", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
        {ADMIN_TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} style={tileStyle}>
            {tile.label}
          </Link>
        ))}
      </div>
    </>
  );
}
