import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address"),
  notes: text("notes"),
  hidden: boolean("hidden").notNull().default(false),
  // The person best placed to speak for this household (contactable,
  // makes decisions) — distinct from just living there (people.householdId
  // already covers that); not every household member is a suitable contact.
  // No .references() here (would need importing people.ts, which itself
  // imports this file for its own householdId FK) — the actual foreign key
  // constraint is enforced at the DB level by the migration script instead;
  // nothing in this codebase uses Drizzle's relational query API to need it
  // represented here too.
  contactPersonId: uuid("contact_person_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
