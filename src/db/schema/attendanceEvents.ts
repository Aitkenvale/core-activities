import { pgTable, uuid, date, boolean, text, timestamp, unique } from "drizzle-orm/pg-core";
import { activityInstances } from "./activityInstances";
import { user } from "./auth";

// One row per activity instance per date it actually ran (a "session").
export const attendanceEvents = pgTable(
  "attendance_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityInstanceId: uuid("activity_instance_id")
      .notNull()
      .references(() => activityInstances.id, { onDelete: "cascade" }),
    sessionDate: date("session_date").notNull(),
    wasGeneratedFromCadence: boolean("was_generated_from_cadence").notNull().default(false),
    // Confirmed by a facilitator once the roll is finalized — present/absent
    // marks become read-only until explicitly unlocked again.
    locked: boolean("locked").notNull().default(false),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.activityInstanceId, table.sessionDate)],
);
