import { pgTable, uuid, text, boolean, pgEnum } from "drizzle-orm/pg-core";
import { activityInstances } from "./activityInstances";
import { user } from "./auth";

export const facilitatorRoleEnum = pgEnum("facilitator_role", ["lead", "assistant"]);

export const activityFacilitators = pgTable("activity_facilitators", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityInstanceId: uuid("activity_instance_id")
    .notNull()
    .references(() => activityInstances.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: facilitatorRoleEnum("role").notNull().default("lead"),
  active: boolean("active").notNull().default(true),
});
