import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Missing Data" };

const linkStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: "var(--tap-min)",
  background: "var(--card-bg)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "10px var(--space-4)",
  fontSize: "0.9rem",
  color: "var(--text)",
};

export default async function MissingDataPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ maxWidth: 640, padding: "0 9px" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-3)" }}>
          Missing Data
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 var(--space-5)" }}>
          Current participants aged 4+ who&rsquo;ve attended twice or more in the last 4 weeks, grouped by activity,
          with any missing essential information — surname, rego, household, household contact, household contact
          mobile.
        </p>

        <a href="/api/admin/missing-data-report" style={linkStyle}>
          <span>PDF (A4)</span>
          <span style={{ fontSize: "0.75rem", color: "var(--heading)" }}>Download</span>
        </a>
      </div>
    </div>
  );
}
