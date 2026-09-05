import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generateFamilyReportPdf, type FamilyReportCategory } from "@/lib/reports/familyReport";

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
    const buffer = await generateFamilyReportPdf(category);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${category.toUpperCase()} Family Report.pdf"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Couldn't generate that report.", { status: 400 });
  }
}
