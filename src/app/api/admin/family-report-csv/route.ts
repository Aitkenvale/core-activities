import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generateFamilyReportCsv, type FamilyReportCategory } from "@/lib/reports/familyReport";

function isValidCategory(value: string | null): value is FamilyReportCategory {
  return value === "psec" || value === "jysep";
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") return new Response("Admin only", { status: 403 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  if (!isValidCategory(category)) return new Response("Missing or invalid category (psec or jysep)", { status: 400 });

  try {
    const csv = await generateFamilyReportCsv(category);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${category.toUpperCase()} Family Report.csv"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Couldn't generate that report.", { status: 400 });
  }
}
