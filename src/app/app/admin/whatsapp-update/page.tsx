import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { getSchoolActivityOptions } from "@/lib/reports/schoolAttendanceReport";
import { WhatsappUpdatePicker } from "./WhatsappUpdatePicker";

export const metadata: Metadata = { title: "WhatsApp Update" };

export default async function WhatsappUpdatePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  // The same PSEC and JYSEP groups that Attendance for Schools offers.
  const options = await getSchoolActivityOptions();

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 9px" }}>
        <AdminPageHeader title="WhatsApp Update" marginBottom="var(--space-3)" />
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 var(--space-5)" }}>
          Choose which PSEC and JYSEP groups to include, and get everyone who&rsquo;s been to one of each group&rsquo;s last
          4 lessons as one row per household contact with their participants alongside — for sending a WhatsApp update.
          Mobiles are written with the country code (+61), and anyone with no contact on file is listed at the bottom.
        </p>

        <WhatsappUpdatePicker options={options} />
      </div>
    </div>
  );
}
