import { pgTable, uuid, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { households } from "./households";

// Immutable log of every public /register submission — kept separate from
// the People/Household rows it creates, since those get edited and merged
// over time (same reasoning as activity_enrollment_role_history: a
// mutable current-state table isn't proof of what was actually submitted
// and agreed to at the time). rawData is the exact children[]/parents[]
// payload as submitted, unmodified.
export const registrationSubmissions = pgTable("registration_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  language: text("language").notNull(),
  rawData: jsonb("raw_data").notNull(),
  consentGiven: boolean("consent_given").notNull(),
  guardianConfirmed: boolean("guardian_confirmed").notNull(),
  // Traceability, not a foreign-key-enforced relationship — the household
  // and people it points at can later be merged/edited/hidden like any
  // other record, without needing to touch this log.
  householdId: uuid("household_id").references(() => households.id),
  createdPersonIds: jsonb("created_person_ids").notNull(),
});
