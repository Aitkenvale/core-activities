import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generateSchoolAttendanceReportXlsx } from "@/lib/reports/schoolAttendanceReport";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") return new Response("Admin only", { status: 403 });

  const { searchParams } = new URL(request.url);
  const activityIds = (searchParams.get("activityIds") ?? "").split(",").filter(Boolean);
  if (activityIds.length === 0) return new Response("Select at least one activity", { status: 400 });

  try {
    const buffer = await generateSchoolAttendanceReportXlsx(activityIds);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="School Attendance.xlsx"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Couldn't generate that report.", { status: 400 });
  }
}
