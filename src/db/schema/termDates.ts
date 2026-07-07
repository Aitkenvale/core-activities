import { pgTable, uuid, integer, date } from "drizzle-orm/pg-core";

// Admin hand-entered once a year, used to skip school-holiday gaps
// when computing the "weekly during term" cadence's next expected date.
export const termDates = pgTable("term_dates", {
  id: uuid("id").primaryKey().defaultRandom(),
  year: integer("year").notNull(),
  termNumber: integer("term_number").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
});
