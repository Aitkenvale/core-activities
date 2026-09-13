import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generateMissingDataReportPdf } from "@/lib/reports/missingDataReport";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") return new Response("Admin only", { status: 403 });

  try {
    const buffer = await generateMissingDataReportPdf();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Missing Data Report.pdf"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Couldn't generate that report.", { status: 400 });
  }
}
