import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generateFamilyReportCsv } from "@/lib/reports/familyReport";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") return new Response("Admin only", { status: 403 });

  try {
    const csv = await generateFamilyReportCsv();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Family Report.csv"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Couldn't generate that report.", { status: 400 });
  }
}
