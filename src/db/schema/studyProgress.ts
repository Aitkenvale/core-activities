import { pgTable, uuid, smallint, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { people } from "./people";
import { user } from "./auth";

// "Not studied" isn't a stored status — it's the absence of a row — so only
// the two states that actually carry information exist here.
export const studyStatusEnum = pgEnum("ruhi_unit_status", ["partial", "complete"]);

// A person's study log, for every programme that keeps one — Ruhi (books x
// units), Children's Grades, Junior Youth Texts; see src/lib/studyTracks.ts.
// One row per box they've started or finished. Keyed by person, not by
// activity — the log belongs to the participant and follows them between
// activities, rather than being scoped to whichever one it happened to be
// recorded in. Which rows and units exist is enforced in studyTracks.ts
// rather than as DB constraints, so changing a list later doesn't need a
// migration.
//
// The table and enum keep their original "ruhi" names — it started life as
// the Ruhi log, and renaming it would have meant downtime for a feature that
// was already in use. `item` is the `book` column: whichever row number the
// track uses (a Ruhi book, a grade, a text's permanent id), and `unit` is 1
// for the tracks that have no units.
export const studyProgress = pgTable(
  "ruhi_unit_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    track: text("track").notNull().default("ruhi"),
    item: smallint("book").notNull(),
    unit: smallint("unit").notNull(),
    status: studyStatusEnum("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: text("updated_by_user_id").references(() => user.id),
  },
  (table) => [uniqueIndex("ruhi_unit_progress_person_track_book_unit_key").on(table.personId, table.track, table.item, table.unit)],
);
