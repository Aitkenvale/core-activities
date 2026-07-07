import { pgTable, uuid, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { activityCategories } from "./activityCategories";
import { neighbourhoods } from "./neighbourhoods";

export const activityStatusEnum = pgEnum("activity_status", ["active", "paused", "archived"]);
export const cadenceTypeEnum = pgEnum("cadence_type", [
  "weekly_term",
  "every_n_weeks",
  "nth_weekday_of_month",
  "ad_hoc",
]);

export const activityInstances = pgTable("activity_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: text("category_id")
    .notNull()
    .references(() => activityCategories.id),
  neighbourhoodId: uuid("neighbourhood_id")
    .notNull()
    .references(() => neighbourhoods.id),
  name: text("name").notNull(), // e.g. "Aitkenvale — Tuesday — Grade 1"
  description: text("description"),
  status: activityStatusEnum("status").notNull().default("active"),
  cadenceType: cadenceTypeEnum("cadence_type").notNull(),
  // Shape depends on cadenceType — see src/lib/cadence.ts
  cadenceConfig: jsonb("cadence_config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
