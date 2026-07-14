import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAvailableTerms } from "@/lib/pdf/attendanceReport";

export const metadata: Metadata = { title: "Attendance Records" };

export default async function AttendanceRecordsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const terms = await getAvailableTerms();

  return (
    // Admin function edited on a computer — full desktop width like the
    // other Edit screens (see isAdminWidePage), not the mobile phone-frame.
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ maxWidth: 640, padding: "0 9px" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-3)" }}>
          Attendance Records
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 var(--space-5)" }}>
          One PDF per term — a page per activity listing everyone who actually attended that term (participants and
          facilitators alike), with a column per session date held.
        </p>

        {terms.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>No terms with recorded attendance yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {terms.map((t) => (
              <a
                key={`${t.year}-${t.termNumber}`}
                href={`/api/admin/attendance-report?year=${t.year}&term=${t.termNumber}`}
                style={{
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
                }}
              >
                <span>
                  {t.year} Term {t.termNumber}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--warm)" }}>Download PDF</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
