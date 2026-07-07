import { pgTable, text, integer } from "drizzle-orm/pg-core";

// Fixed, small, seeded lookup — not admin-editable via UI in this phase.
export const activityCategories = pgTable("activity_categories", {
  id: text("id").primaryKey(), // e.g. "psec", "jysep", "sc", "camp"
  label: text("label").notNull(),
  defaultAgeMin: integer("default_age_min"),
  defaultAgeMax: integer("default_age_max"),
  sortOrder: integer("sort_order").notNull(),
});
