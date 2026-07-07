import { pgTable, uuid, text, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { households } from "./households";

export const personTypeEnum = pgEnum("person_type", ["child", "guardian"]);
export const personLinkStatusEnum = pgEnum("person_link_status", ["linked", "pending"]);
export const personSourceEnum = pgEnum("person_source", [
  "registration_form",
  "admin_manual",
  "bulk_import",
  "quick_add",
]);

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id),
  name: text("name").notNull(),
  personType: personTypeEnum("person_type").notNull(),
  dob: date("dob"),
  mobile: text("mobile"),
  email: text("email"),
  bahaiStatus: text("bahai_status"),
  category: text("category"),
  healthNotes: text("health_notes"),
  hidden: boolean("hidden").notNull().default(false),
  // "pending" = quick-added by a facilitator, incomplete, awaiting reconciliation.
  linkStatus: personLinkStatusEnum("link_status").notNull().default("linked"),
  source: personSourceEnum("source").notNull().default("admin_manual"),
  comment: text("comment"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
