import { pgTable, uuid, text, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { attendanceEvents } from "./attendanceEvents";
import { people } from "./people";
import { user } from "./auth";

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent"]);

// Person x session. A quick-added child is a real `people` row (link_status
// "pending") by the time this record is created — see people.ts.
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attendanceEventId: uuid("attendance_event_id")
      .notNull()
      .references(() => attendanceEvents.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    recordedByUserId: text("recorded_by_user_id")
      .notNull()
      .references(() => user.id),
  },
  (table) => [unique().on(table.attendanceEventId, table.personId)],
);
