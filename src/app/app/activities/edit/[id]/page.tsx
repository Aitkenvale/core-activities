import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityCategories } from "@/db/schema/activityCategories";
import { neighbourhoods } from "@/db/schema/neighbourhoods";
import { getActivityForEdit } from "../../actions";
import { CreateActivityForm } from "../../CreateActivityForm";

// Same reasoning as the other activities pages — no auth check, so this
// must stay dynamic rather than being frozen at build time.
export const dynamic = "force-dynamic";

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [activity, categories, neighbourhoodRows] = await Promise.all([
    getActivityForEdit(id),
    db.select().from(activityCategories).where(eq(activityCategories.enabled, true)).orderBy(asc(activityCategories.sortOrder)),
    db.select().from(neighbourhoods).orderBy(asc(neighbourhoods.name)),
  ]);

  if (!activity) {
    return <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Activity not found.</p>;
  }

  return <CreateActivityForm categories={categories} neighbourhoods={neighbourhoodRows} mode="edit" initial={activity} />;
}
