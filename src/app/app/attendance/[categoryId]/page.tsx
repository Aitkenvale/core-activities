import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityCategories } from "@/db/schema/activityCategories";
import { activityInstances } from "@/db/schema/activityInstances";

export default async function ActivityInstanceList({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  // Independent queries — fire together instead of one round trip at a time.
  // Every signed-in user (Facilitator or Admin) sees every active activity
  // here — the Facilitator/Admin split is about the dedicated Admin
  // Functions area, not about which activities someone can take attendance
  // for, so this doesn't need the caller's session at all.
  const [[category], instances] = await Promise.all([
    db.select().from(activityCategories).where(eq(activityCategories.id, categoryId)),
    db
      .select()
      .from(activityInstances)
      .where(and(eq(activityInstances.categoryId, categoryId), eq(activityInstances.status, "active"), eq(activityInstances.hidden, false)))
      .orderBy(asc(activityInstances.name)),
  ]);

  return (
    <>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-5)" }}>
        {category?.label}
      </h2>
      {instances.length === 0 && <p style={{ color: "var(--muted)" }}>No activities yet in this category.</p>}
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
