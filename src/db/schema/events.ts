import { pgTable, uuid, date, text, timestamp } from "drizzle-orm/pg-core";

// Simple one-off community events (e.g. a Neighbourhood Reflection
// Meeting) — deliberately not the same thing as activity_instances,
// which are recurring classes/programs with their own cadence and
// attendance tracking. Just a date and a short line of text, editable by
// any signed-in user (not admin-gated) and hard-deleted when removed —
// no other table references an event, so there's nothing a soft-delete
// would need to protect.
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
