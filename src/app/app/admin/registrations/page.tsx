import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { registrationSubmissions } from "@/db/schema/registrationSubmissions";
import { households } from "@/db/schema/households";
import type { RegistrationChild, RegistrationParent } from "../../../register/actions";

// Read-only — there's no email notification for a new /register
// submission (a deliberate zero-cost, zero-new-service choice), so this
// list is the only way an admin finds out one came in. What actually
// needs doing about it (reconciling the new "pending" People it created
// against existing records) happens in the normal People grid, not here.
export default async function RegistrationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const rows = await db
    .select({
      id: registrationSubmissions.id,
      submittedAt: registrationSubmissions.submittedAt,
      language: registrationSubmissions.language,
      rawData: registrationSubmissions.rawData,
      consentGiven: registrationSubmissions.consentGiven,
      guardianConfirmed: registrationSubmissions.guardianConfirmed,
      householdId: registrationSubmissions.householdId,
      householdName: households.name,
    })
    .from(registrationSubmissions)
    .leftJoin(households, eq(households.id, registrationSubmissions.householdId))
    .orderBy(desc(registrationSubmissions.submittedAt))
    .limit(100);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-3) var(--space-3) 40px" }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 4 }}>
        Registrations
      </h2>
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "var(--space-4)" }}>
        Every /register submission, most recent first — a permanent record of what was actually submitted and
        agreed to, kept separately from the People/Household records it created (those get edited and merged over
        time; this doesn&rsquo;t).
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No registrations yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {rows.map((r) => {
            const data = r.rawData as { children: RegistrationChild[]; parents: RegistrationParent[] };
            return (
              <div key={r.id} style={{ background: "var(--card-bg)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: "var(--space-3) var(--space-4)" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                    {new Date(r.submittedAt).toLocaleString("en-AU")} <span style={{ color: "var(--muted)" }}>({r.language.toUpperCase()})</span>
                  </span>
                  {r.householdName && (
                    <Link href={`/app/admin/people?q=${encodeURIComponent(r.householdName)}`} style={{ fontSize: "0.78rem", color: "var(--heading)", textDecoration: "underline" }}>
                      {r.householdName} — view in People
                    </Link>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", fontSize: "0.82rem", color: "var(--text)" }}>
                  <div>
                    <p style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>Children</p>
                    {data.children.map((c, i) => (
                      <p key={i} style={{ margin: "0 0 2px" }}>
                        {c.name} — {c.dob}
                        {c.hasHealth && c.health ? ` (${c.health})` : ""}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>Parents / Guardians</p>
                    {data.parents.map((p, i) => (
                      <p key={i} style={{ margin: "0 0 2px" }}>
                        {p.name} — {p.mobile}
                        {p.email ? ` — ${p.email}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 8 }}>
                  {r.consentGiven && r.guardianConfirmed ? "Permissions accepted, guardian confirmed." : "⚠ Incomplete consent on file."}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
