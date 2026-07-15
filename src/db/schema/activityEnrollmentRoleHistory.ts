import { pgTable, uuid, date, timestamp, text } from "drizzle-orm/pg-core";
import { activityEnrollments, enrollmentRoleEnum } from "./activityEnrollments";
import { user } from "./auth";

// Facilitator/Assistant is a point-in-time classification, not a fixed
// label — someone can be promoted from Co-Teacher to Teacher (or the
// reverse, if a facilitator mis-toggles by mistake) mid-term. The Attendance
// Records PDF needs to know which role was in effect on each *session
// date*, not just whichever role is current today, so a report generated
// after a promotion doesn't retroactively rewrite earlier terms. This is
// the append-only source of truth for that; activityEnrollments.role stays
// as the fast-access "current role" used everywhere else in the app.
export const activityEnrollmentRoleHistory = pgTable("activity_enrollment_role_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => activityEnrollments.id, { onDelete: "cascade" }),
  // Reuses enrollment_role, but only ever "facilitator" or "assistant" here
  // — participants don't have a role history.
  role: enrollmentRoleEnum("role").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  recordedByUserId: text("recorded_by_user_id").references(() => user.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});
