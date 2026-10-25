import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { parseActivityIds } from "@/lib/reports/activityIds";
import { familyReportPdf, getFamilyReport } from "@/lib/reports/familyReport";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") return new Response("Admin only", { status: 403 });

  const { searchParams } = new URL(request.url);
  const activityIds = parseActivityIds(searchParams.get("activityIds"));
  if (!activityIds) return new Response("Select at least one class", { status: 400 });

  try {
    const report = await getFamilyReport(activityIds);
    const buffer = await familyReportPdf(report);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.label} Family Visit Planner.pdf"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Couldn't generate that report.", { status: 400 });
  }
}
