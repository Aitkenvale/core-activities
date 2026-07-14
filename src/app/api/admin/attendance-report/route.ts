import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generateAttendanceReportPdf } from "@/lib/pdf/attendanceReport";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") return new Response("Admin only", { status: 403 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? "", 10);
  const termNumber = parseInt(searchParams.get("term") ?? "", 10);
  if (!year || !termNumber) return new Response("Missing year/term", { status: 400 });

  try {
    const buffer = await generateAttendanceReportPdf(year, termNumber);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Attendance ${year} Term ${termNumber}.pdf"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Couldn't generate that report.", { status: 400 });
  }
}
