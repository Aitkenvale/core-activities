import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

// Fixed, small, seeded lookup — not admin-editable via UI in this phase.
export const activityCategories = pgTable("activity_categories", {
  id: text("id").primaryKey(), // internal code e.g. "psec", "jysep", "sc", "camp" — unrelated to the friendly `label`
  label: text("label").notNull(), // friendly display name, e.g. "Children's Class"
  defaultAgeMin: integer("default_age_min"),
  defaultAgeMax: integer("default_age_max"),
  sortOrder: integer("sort_order").notNull(),
  // Hidden from the category picker until fully specced (e.g. Camp, Social Action) —
  // kept in the database rather than deleted so it can be re-enabled later.
  enabled: boolean("enabled").notNull().default(true),
});
