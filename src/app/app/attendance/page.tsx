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
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
      <Link href="/app" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
        ← Back
      </Link>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", color: "var(--deep)", margin: "16px 0 24px" }}>
        Update Attendance
      </h1>
      <div style={{ display: "grid", gap: 12 }}>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/app/attendance/${cat.id}`}
            style={{
              display: "block",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 20,
              fontSize: "0.95rem",
              color: "var(--text)",
            }}
          >
            {cat.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
