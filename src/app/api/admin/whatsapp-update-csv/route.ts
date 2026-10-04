import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generateWhatsappUpdateCsv, parseActivityIds } from "@/lib/reports/whatsappUpdate";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") return new Response("Admin only", { status: 403 });

  const { searchParams } = new URL(request.url);
  const activityIds = parseActivityIds(searchParams.get("activityIds"));
  if (!activityIds) return new Response("Select at least one group", { status: 400 });

  try {
    const csv = await generateWhatsappUpdateCsv(activityIds);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="WhatsApp Update.csv"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Couldn't generate that report.", { status: 400 });
  }
}
