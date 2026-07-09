import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { termDates } from "@/db/schema/termDates";
import { getEditWindowMonths } from "@/lib/settings";
import { TermDatesEditor } from "@/app/app/admin/activities/TermDatesEditor";
import { SecurityCard } from "./SecurityCard";
import { cardStyle, cardTitleStyle } from "./styles";

export default async function AdminSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const [editWindowMonths, terms] = await Promise.all([
    getEditWindowMonths(),
    db.select().from(termDates).orderBy(asc(termDates.year), asc(termDates.termNumber)),
  ]);

  return (
    <>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-6)" }}>
        Settings
      </h2>

      <SecurityCard initialMonths={editWindowMonths} />

      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Activities</h3>
        <TermDatesEditor initialTerms={terms} />
      </div>
    </>
  );
}
