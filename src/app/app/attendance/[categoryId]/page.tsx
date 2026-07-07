import { headers } from "next/headers";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityCategories } from "@/db/schema/activityCategories";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityFacilitators } from "@/db/schema/activityFacilitators";
import { termDates } from "@/db/schema/termDates";
import { getNextExpectedDate, type CadenceConfig, type CadenceType } from "@/lib/cadence";

export default async function ActivityInstanceList({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  // Independent queries — fire together instead of one round trip at a time.
  const [session, [category], terms] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    db.select().from(activityCategories).where(eq(activityCategories.id, categoryId)),
    db.select().from(termDates),
  ]);
  const isAdmin = session?.user?.role === "admin";

  const instances = isAdmin
    ? await db.select().from(activityInstances).where(and(eq(activityInstances.categoryId, categoryId), eq(activityInstances.status, "active")))
    : await db
        .select({ activityInstances })
        .from(activityInstances)
        .innerJoin(
          activityFacilitators,
          and(
            eq(activityFacilitators.activityInstanceId, activityInstances.id),
            eq(activityFacilitators.userId, session!.user.id),
            eq(activityFacilitators.active, true),
          ),
        )
        .where(and(eq(activityInstances.categoryId, categoryId), eq(activityInstances.status, "active")))
        .then((rows) => rows.map((r) => r.activityInstances));

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
      <Link href="/app/attendance" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
        ← Back
      </Link>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", color: "var(--deep)", margin: "16px 0 24px" }}>
        {category?.label}
      </h1>
      {instances.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          {isAdmin ? "No activities yet in this category." : "You're not assigned to any activities in this category yet."}
        </p>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {instances.map((instance) => {
          const next = getNextExpectedDate(
            instance.cadenceType as CadenceType,
            instance.cadenceConfig as CadenceConfig,
            terms.map((t) => ({ startDate: t.startDate, endDate: t.endDate })),
          );
          return (
            <Link
              key={instance.id}
              href={`/app/attendance/${categoryId}/${instance.id}/session`}
              style={{
                display: "block",
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 20,
                color: "var(--text)",
              }}
            >
              <div style={{ fontSize: "0.95rem" }}>{instance.name}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 4 }}>
                {next ? `Next expected: ${next}` : "No fixed schedule"}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
