import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityCategories } from "@/db/schema/activityCategories";

export default async function AttendanceCategoryPicker() {
  const categories = await db
    .select()
    .from(activityCategories)
    .where(eq(activityCategories.enabled, true))
    .orderBy(asc(activityCategories.sortOrder));

  return (
    <>
      {/* No body heading — AppHeader's sticky title already shows "Update
          Attendance" for this route (src/lib/pageTitle.ts). */}
      <div style={{ display: "grid", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/app/attendance/${cat.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              minHeight: "var(--tap-min)",
              background: "var(--card-bg)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-card)",
              padding: "var(--space-5)",
              fontSize: "1.05rem",
              color: "var(--text)",
            }}
          >
            {cat.label}
          </Link>
        ))}
      </div>
    </>
  );
}
