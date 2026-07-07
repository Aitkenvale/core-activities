import { headers } from "next/headers";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
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
    <>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--deep)", margin: "0 0 20px" }}>
        {category?.label}
      </h2>
      {instances.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          {isAdmin ? "No activities yet in this category." : "You're not assigned to any activities in this category yet."}
        </p>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {instances.map((instance) => (
          <Link
            key={instance.id}
            href={`/app/attendance/${categoryId}/${instance.id}/session`}
            style={{
              display: "block",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "12px 14px",
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
