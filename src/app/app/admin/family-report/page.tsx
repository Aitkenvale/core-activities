import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Family Report" };

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

export default async function FamilyReportPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ maxWidth: 640, padding: "0 9px" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-3)" }}>
          Family Report
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 var(--space-5)" }}>
          Households with a participant who&rsquo;s attended in the last 3 months, grouped by suburb — participant
          names, their class, and the household&rsquo;s address and contact. PSEC and JYSEP are separate downloads.
        </p>

        {(["psec", "jysep"] as const).map((category) => (
          <div key={category} style={{ marginBottom: "var(--space-5)" }}>
            <h3 style={{ fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--warm)", marginBottom: 8 }}>
              {category.toUpperCase()}
            </h3>
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              <a href={`/api/admin/family-report-pdf?category=${category}`} style={linkStyle}>
                <span>PDF (A4, print-ready)</span>
                <span style={{ fontSize: "0.75rem", color: "var(--heading)" }}>Download</span>
              </a>
              <a href={`/api/admin/family-report-csv?category=${category}`} style={linkStyle}>
                <span>CSV (spreadsheet)</span>
                <span style={{ fontSize: "0.75rem", color: "var(--heading)" }}>Download</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
