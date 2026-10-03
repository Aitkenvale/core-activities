// Server-only: renaming an activity. Kept out of the "use server" action files
// so it can be tested without a login session.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";

// The longest name a rename accepts — far longer than any real one ("Senghor
// home — R2 — MC"), just a stop on something pasted by mistake.
export const MAX_ACTIVITY_NAME = 120;

// Returns the name as saved (trimmed). Throws if it's empty or too long, or if
// there is no such activity.
export async function renameActivityInstance(activityInstanceId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  if (trimmed.length > MAX_ACTIVITY_NAME) throw new Error(`Keep the name under ${MAX_ACTIVITY_NAME} characters.`);
  const rows = await db
    .update(activityInstances)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(activityInstances.id, activityInstanceId))
    .returning({ id: activityInstances.id });
  if (rows.length === 0) throw new Error("That activity no longer exists.");
  return trimmed;
}
