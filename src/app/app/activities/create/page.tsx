import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityCategories } from "@/db/schema/activityCategories";
import { neighbourhoods } from "@/db/schema/neighbourhoods";
import { CreateActivityForm } from "../CreateActivityForm";

// This page has no auth check to force dynamic rendering (it's
// intentionally open to any signed-in user, not just admins), so without
// this Next.js would prerender it statically and freeze the category/
// neighbourhood lists at build time — new neighbourhoods wouldn't show up
// here until the next deploy.
export const dynamic = "force-dynamic";

export default async function CreateActivityPage() {
  const [categories, neighbourhoodRows] = await Promise.all([
    db.select().from(activityCategories).where(eq(activityCategories.enabled, true)).orderBy(asc(activityCategories.sortOrder)),
    db.select().from(neighbourhoods).orderBy(asc(neighbourhoods.name)),
  ]);

  return <CreateActivityForm categories={categories} neighbourhoods={neighbourhoodRows} />;
}
