import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { ActivityPicker } from "./ActivityPicker";

// Same reasoning as the create-activity page — no auth check, so this must
// stay dynamic rather than being frozen at build time.
export const dynamic = "force-dynamic";

export default async function EditActivityPickerPage() {
  const [rows, categories] = await Promise.all([
    db
      .select({ id: activityInstances.id, name: activityInstances.name, categoryId: activityInstances.categoryId, status: activityInstances.status })
      .from(activityInstances)
      .where(eq(activityInstances.hidden, false))
      .orderBy(asc(activityInstances.name)),
    db.select().from(activityCategories),
  ]);

  const categoryLabels = Object.fromEntries(categories.map((c) => [c.id, c.label]));

  return <ActivityPicker activities={rows} categoryLabels={categoryLabels} />;
}
