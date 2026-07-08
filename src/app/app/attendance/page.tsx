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
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-6)" }}>
        Update Attendance
      </h2>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
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
