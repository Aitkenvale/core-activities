import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Small generic key/value store for admin-configurable settings that don't
// warrant their own dedicated table — e.g. the non-admin attendance edit
// window. Values are stored as text and parsed by whichever setting reads
// them, since different settings may want different shapes over time.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
