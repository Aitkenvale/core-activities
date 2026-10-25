import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { getSchoolActivityOptions } from "@/lib/reports/schoolAttendanceReport";
import { FamilyReportPicker } from "./FamilyReportPicker";

export const metadata: Metadata = { title: "Family Visit Planner" };

export default async function FamilyReportPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  // The same PSEC and JYSEP classes that Attendance for Schools and WhatsApp Update offer.
  const options = await getSchoolActivityOptions();

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 9px" }}>
        <AdminPageHeader title="Family Visit Planner" marginBottom="var(--space-3)" />
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 var(--space-5)" }}>
          Households with a participant who&rsquo;s attended one of the classes you tick in the last 3 months, grouped by
          suburb — participant names, their class, and the household&rsquo;s address and contact. Download it as a PDF to
          print (one line for each person) or as a spreadsheet.
        </p>

        <FamilyReportPicker options={options} />
      </div>
    </div>
  );
}
