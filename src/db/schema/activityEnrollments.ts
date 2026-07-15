import { pgTable, uuid, boolean, timestamp, unique, pgEnum } from "drizzle-orm/pg-core";
import { activityInstances } from "./activityInstances";
import { people } from "./people";

// "assistant" split off "facilitator" later — Facilitators require regular
// child protection training, Assistants don't. Postgres enums can only ever
// grow, never reorder/remove, hence "assistant" trailing at the end instead
// of sitting next to "facilitator".
export const enrollmentRoleEnum = pgEnum("enrollment_role", ["participant", "facilitator", "assistant"]);

// Who's expected on an activity's roster — distinct from attendance history,
// so a newly quick-added or newly enrolled person shows up before they've
// ever actually attended a session.
export const activityEnrollments = pgTable(
  "activity_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityInstanceId: uuid("activity_instance_id")
      .notNull()
      .references(() => activityInstances.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    // Roster split (participants shown separately from facilitators). Distinct
    // from activity_facilitators, which links a real *user account* for
    // login/permission purposes — a facilitator here may have no account yet.
    role: enrollmentRoleEnum("role").notNull().default("participant"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [unique().on(table.activityInstanceId, table.personId)],
);
