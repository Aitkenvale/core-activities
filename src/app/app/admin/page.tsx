import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

const SECTIONS = [
  {
    label: "Editing",
    tiles: [
      { href: "/app/admin/people", label: "Edit All People" },
      { href: "/app/admin/households", label: "Edit Households" },
      { href: "/app/admin/activities", label: "Edit Activities" },
      { href: "/app/admin/roles", label: "Teacher / Co-Teacher Roles" },
      { href: "/app/admin/attendance", label: "Edit Attendance" },
    ],
  },
  {
    label: "Reports",
    tiles: [
      { href: "/app/admin/attendance-records", label: "Attendance Records" },
      { href: "/app/admin/school-attendance", label: "School Attendance" },
      { href: "/app/admin/family-report", label: "Family Report" },
      { href: "/app/admin/registrations", label: "Registrations" },
    ],
  },
  {
    label: "Settings",
    tiles: [{ href: "/app/admin/settings", label: "Settings" }],
  },
];

const sectionHeadingStyle = {
  fontSize: "0.75rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "var(--warm)",
  marginBottom: 8,
};

const listContainerStyle = {
  background: "var(--card-bg)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-card)",
  overflow: "hidden",
};

const listRowStyle = {
  display: "flex",
  alignItems: "center",
  minHeight: "var(--tap-min)",
  padding: "0 var(--space-5)",
  fontSize: "1.05rem",
  color: "var(--text)",
};

export default async function AdminMenuPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  return (
    // Wide/desktop-oriented like every other admin page now (see
    // isAdminWidePage) — AppHeader no longer renders here, so this needs
    // its own heading instead of relying on the sticky title bar.
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ maxWidth: 640, padding: "0 9px" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: "var(--space-4)" }}>
          Admin Functions
        </h2>
        {SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: "var(--space-5)" }}>
            <div style={sectionHeadingStyle}>{section.label}</div>
            <div style={listContainerStyle}>
              {section.tiles.map((tile, i) => (
                <Link
                  key={tile.href}
                  href={tile.href}
                  style={{
                    ...listRowStyle,
                    borderBottom: i < section.tiles.length - 1 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  {tile.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
