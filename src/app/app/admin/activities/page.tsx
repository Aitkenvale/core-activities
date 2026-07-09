import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { neighbourhoods } from "@/db/schema/neighbourhoods";
import { ActivitiesGrid } from "./ActivitiesGrid";

export default async function AdminActivitiesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const [rows, categories, neighbourhoodRows] = await Promise.all([
    // Everything beyond this overview (cadence, notes, roster, ...) is now
    // edited via the full Edit Activity form opened from this grid, so the
    // overview query only needs what's actually displayed or filtered on.
    db
      .select({
        id: activityInstances.id,
        name: activityInstances.name,
        categoryId: activityInstances.categoryId,
        neighbourhoodId: activityInstances.neighbourhoodId,
        startDate: activityInstances.startDate,
        hidden: activityInstances.hidden,
        cadenceType: activityInstances.cadenceType,
      })
      .from(activityInstances)
      .orderBy(asc(activityInstances.name)),
    db.select().from(activityCategories).orderBy(asc(activityCategories.sortOrder)),
    db.select().from(neighbourhoods).orderBy(asc(neighbourhoods.name)),
  ]);

  return <ActivitiesGrid initialRows={rows} categories={categories} neighbourhoods={neighbourhoodRows} />;
}
