import { db } from "./client";
import { termDates } from "./schema/termDates";

// From the imported 2026 sheet's own week-date columns.
async function seed() {
  await db
    .insert(termDates)
    .values([
      { year: 2026, termNumber: 1, startDate: "2026-01-26", endDate: "2026-03-30" },
      { year: 2026, termNumber: 2, startDate: "2026-04-20", endDate: "2026-06-22" },
    ])
    .onConflictDoNothing();
  console.log("Seeded term_dates");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
