import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSchoolActivityOptions } from "@/lib/reports/schoolAttendanceReport";
import { SchoolAttendancePicker } from "./SchoolAttendancePicker";

export const metadata: Metadata = { title: "School Attendance" };

export default async function SchoolAttendancePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const options = await getSchoolActivityOptions();

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <SchoolAttendancePicker options={options} />
    </div>
  );
}
