import { pgTable, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { activityInstances } from "./activityInstances";
import { people } from "./people";

// Who's expected on an activity's roster — distinct from attendance history,
// so a newly quick-added or newly enrolled person shows up before they've
// ever actually attended a session.
export const activityEnrollments = pgTable("activity_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityInstanceId: uuid("activity_instance_id")
    .notNull()
    .references(() => activityInstances.id, { onDelete: "cascade" }),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
});
