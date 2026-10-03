import { pgTable, uuid, smallint, text, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { people } from "./people";
import { user } from "./auth";

// "Not studied" isn't a stored status — it's the absence of a row — so only
// the two states that actually carry information exist here.
export const ruhiUnitStatusEnum = pgEnum("ruhi_unit_status", ["partial", "complete"]);

// A person's Ruhi study log: one row per (book, unit) they've started or
// finished. Keyed by person, not by activity — the log belongs to the
// participant and follows them between Ruhi Camps, rather than being
// scoped to whichever camp it happened to be recorded in. Book/unit bounds
// (14 books, 3 units each) are enforced in src/lib/ruhi.ts rather than as
// DB constraints, so changing them later doesn't need a migration.
export const ruhiUnitProgress = pgTable(
  "ruhi_unit_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    book: smallint("book").notNull(),
    unit: smallint("unit").notNull(),
    status: ruhiUnitStatusEnum("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: text("updated_by_user_id").references(() => user.id),
  },
  (table) => [unique().on(table.personId, table.book, table.unit)],
);
