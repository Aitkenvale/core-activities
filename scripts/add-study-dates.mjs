// One-off: give every study-log box a date — the day it reached its current
// state (partly done, or completed) — by adding a nullable `status_date`
// column to ruhi_unit_progress. The dates are hidden: no screen shows them,
// they're kept for analysis later.
//
// Additive and nullable, so the code that is live right now is unaffected: it
// neither reads nor writes the column, and a row it creates simply has no date
// until the backfill (or the next change) gives it one. Run it BEFORE pushing
// the code that writes the dates. Safe to re-run.
//
//   set -a && source .env.local && set +a && node scripts/add-study-dates.mjs
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`ALTER TABLE ruhi_unit_progress ADD COLUMN IF NOT EXISTS status_date date`);
await client.query(
  `COMMENT ON COLUMN ruhi_unit_progress.status_date IS 'The day this box reached its current state (partly done or completed). Hidden; for analysis. NULL = not recorded yet.'`,
);

const { rows } = await client.query(
  `SELECT count(*)::int AS boxes, count(status_date)::int AS dated FROM ruhi_unit_progress`,
);
console.log(`status_date column in place. Boxes: ${rows[0].boxes}, with a date: ${rows[0].dated}.`);

await client.end();
