import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { neighbourhoods } from "@/db/schema/neighbourhoods";
import { termDates } from "@/db/schema/termDates";
import { ActivitiesGrid } from "./ActivitiesGrid";
import { TermDatesEditor } from "./TermDatesEditor";

export default async function AdminActivitiesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const [rows, categories, neighbourhoodRows, terms] = await Promise.all([
    db
      .select({
        id: activityInstances.id,
        name: activityInstances.name,
        categoryId: activityInstances.categoryId,
        categoryLabel: activityCategories.label,
        neighbourhoodId: activityInstances.neighbourhoodId,
        neighbourhoodName: neighbourhoods.name,
        description: activityInstances.description,
        status: activityInstances.status,
        pausedAt: activityInstances.pausedAt,
        startDate: activityInstances.startDate,
        endDate: activityInstances.endDate,
        hidden: activityInstances.hidden,
        cadenceType: activityInstances.cadenceType,
        cadenceConfig: activityInstances.cadenceConfig,
      })
      .from(activityInstances)
      .leftJoin(activityCategories, eq(activityCategories.id, activityInstances.categoryId))
      .leftJoin(neighbourhoods, eq(neighbourhoods.id, activityInstances.neighbourhoodId))
      .orderBy(asc(activityInstances.name)),
    db.select().from(activityCategories).orderBy(asc(activityCategories.sortOrder)),
    db.select().from(neighbourhoods).orderBy(asc(neighbourhoods.name)),
    db.select().from(termDates).orderBy(asc(termDates.year), asc(termDates.termNumber)),
  ]);

  return (
    <>
      <ActivitiesGrid initialRows={rows} categories={categories} neighbourhoods={neighbourhoodRows} />
      <TermDatesEditor initialTerms={terms} />
    </>
  );
}
