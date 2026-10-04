import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { getWhatsappUpdate } from "@/lib/reports/whatsappUpdate";

export const metadata: Metadata = { title: "WhatsApp Update" };

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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function WhatsappUpdatePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const report = await getWhatsappUpdate();
  const since = new Date(`${report.from}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
  const gaps = [
    report.withoutContactCount > 0 ? `${plural(report.withoutContactCount, "participant")} with no contact on file (listed at the bottom)` : null,
    report.contactsWithoutMobileCount > 0 ? `${plural(report.contactsWithoutMobileCount, "contact")} with no mobile` : null,
  ].filter((g): g is string => g !== null);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ maxWidth: 640, padding: "0 9px" }}>
        <AdminPageHeader title="WhatsApp Update" marginBottom="var(--space-3)" />
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 var(--space-3)" }}>
          Everyone who&rsquo;s attended in the last 4 weeks (since {since}), as one row per household contact with their
          participants alongside — for sending a WhatsApp update. Mobiles are written with the country code (+61).
        </p>
        <p style={{ fontSize: "0.85rem", color: "var(--text)", margin: "0 0 var(--space-5)" }}>
          {plural(report.contactCount, "contact")}, {plural(report.participantCount, "participant")}
          {gaps.length > 0 && <span style={{ color: "var(--muted)" }}> — including {gaps.join(" and ")}</span>}.
        </p>

        <a href="/api/admin/whatsapp-update-csv" style={linkStyle}>
          <span>CSV (spreadsheet)</span>
          <span style={{ fontSize: "0.75rem", color: "var(--heading)" }}>Download</span>
        </a>
      </div>
    </div>
  );
}
