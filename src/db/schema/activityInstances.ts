import { pgTable, uuid, text, date, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { activityCategories } from "./activityCategories";
import { neighbourhoods } from "./neighbourhoods";

// The underlying Postgres enum also still permits the old 'weekly_term'/
// 'nth_weekday_of_month' cadence values (Postgres can't drop enum values,
// and nothing ever used them) — the app just never reads or writes them.
// 'archived' was likewise dead until now — repurposed as the DB value for
// "Complete" (see hidden/endDate below) rather than adding a new one.
export const activityStatusEnum = pgEnum("activity_status", ["active", "paused", "archived"]);
export const cadenceTypeEnum = pgEnum("cadence_type", [
  "school_term",
  "every_n_weeks",
  "every_n_months",
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
  description: text("description"), // shown to admins as "Notes"
  status: activityStatusEnum("status").notNull().default("active"),
  // Set when status flips to "paused", cleared when it flips back — drives
  // the paused-too-long warning badge (6+ weeks yellow, 10+ weeks red).
  pausedAt: date("paused_at"),
  // Never suggest a session date before this (the class didn't exist yet).
  startDate: date("start_date"),
  // Ending a class works like People/Households: hidden + a recorded date.
  // Also forces status to "archived" (shown as "Complete") so the two can't
  // show a contradictory combination like Active-but-Hidden.
  endDate: date("end_date"),
  hidden: boolean("hidden").notNull().default(false),
  cadenceType: cadenceTypeEnum("cadence_type").notNull(),
  // Shape depends on cadenceType — see src/lib/cadence.ts
  cadenceConfig: jsonb("cadence_config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
