import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { termDates } from "@/db/schema/termDates";
import { user } from "@/db/schema/auth";
import { allowedSignups } from "@/db/schema/allowedSignups";
import { getEditWindowMonths } from "@/lib/settings";
import { TermDatesEditor } from "@/app/app/admin/activities/TermDatesEditor";
import { SecurityCard } from "./SecurityCard";
import { UsersCard } from "./UsersCard";
import { cardStyle, cardTitleStyle } from "./styles";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const [editWindowMonths, terms, users, pendingSignups] = await Promise.all([
    getEditWindowMonths(),
    db.select().from(termDates).orderBy(asc(termDates.year), asc(termDates.termNumber)),
    db.select({ id: user.id, name: user.name, email: user.email, role: user.role }).from(user).orderBy(asc(user.name)),
    db.select().from(allowedSignups).orderBy(asc(allowedSignups.name)),
  ]);

  return (
    // Admin function edited on a computer — full desktop width like the
    // other Edit screens (see isAdminWidePage), not the mobile phone-frame.
    // Content itself stays at a readable card width rather than
    // stretching to the full 1400px like a spreadsheet would.
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ maxWidth: 640, padding: "0 9px" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-6)" }}>
          Settings
        </h2>

        <SecurityCard initialMonths={editWindowMonths} />

        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Activities</h3>
          <TermDatesEditor initialTerms={terms} />
        </div>

        <UsersCard initialUsers={users} initialPending={pendingSignups} currentUserId={session.user.id} />
      </div>
    </div>
  );
}
