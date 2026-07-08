import { headers } from "next/headers";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityCategories } from "@/db/schema/activityCategories";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityFacilitators } from "@/db/schema/activityFacilitators";

export default async function ActivityInstanceList({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  // Independent queries — fire together instead of one round trip at a time.
  const [session, [category]] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    db.select().from(activityCategories).where(eq(activityCategories.id, categoryId)),
  ]);
  const isAdmin = session?.user?.role === "admin";

  const instances = isAdmin
    ? await db
        .select()
        .from(activityInstances)
        .where(and(eq(activityInstances.categoryId, categoryId), eq(activityInstances.status, "active"), eq(activityInstances.hidden, false)))
        .orderBy(asc(activityInstances.name))
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
        .where(and(eq(activityInstances.categoryId, categoryId), eq(activityInstances.status, "active"), eq(activityInstances.hidden, false)))
        .orderBy(asc(activityInstances.name))
        .then((rows) => rows.map((r) => r.activityInstances));

  return (
    <>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-5)" }}>
        {category?.label}
      </h2>
      {instances.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          {isAdmin ? "No activities yet in this category." : "You're not assigned to any activities in this category yet."}
        </p>
      )}
      {/* Kept deliberately compact (not the full --tap-min height) so ~12
          classes fit on screen without scrolling. */}
      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        {instances.map((instance) => (
          <Link
            key={instance.id}
            href={`/app/attendance/${categoryId}/${instance.id}/session`}
            style={{
              display: "block",
              background: "var(--card-bg)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-card)",
              padding: "var(--space-3) var(--space-4)",
              fontSize: "0.9rem",
              color: "var(--text)",
            }}
          >
            {instance.name}
          </Link>
        ))}
      </div>
    </>
  );
}
