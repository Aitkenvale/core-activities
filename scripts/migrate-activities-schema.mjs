// One-off: extend activity_instances for the new Activities admin feature.
// - New columns: start_date, end_date, hidden, paused_at.
// - cadence_type: rename 'weekly_term' -> 'school_term' (clearer name),
//   add 'every_n_months' (replaces the never-implemented
//   'nth_weekday_of_month'). The old value is left as an orphaned, unused
//   enum option — Postgres can't drop enum values, and recreating the type
//   for a value with zero rows isn't worth the risk.
// - cadenceConfig: {weekday, term_calendar_ref} -> {weekdays: [weekday]}
//   for the 9 existing school_term rows (term_calendar_ref was never read
//   by any code, just import cruft).
// - status enum keeps 'archived' as an orphaned unused value too — the app
//   will only ever write 'active' | 'paused' going forward (ended
//   activities are expressed via hidden + endDate instead).
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`ALTER TABLE activity_instances ADD COLUMN IF NOT EXISTS start_date date`);
await client.query(`ALTER TABLE activity_instances ADD COLUMN IF NOT EXISTS end_date date`);
await client.query(`ALTER TABLE activity_instances ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`);
await client.query(`ALTER TABLE activity_instances ADD COLUMN IF NOT EXISTS paused_at date`);
console.log("Added start_date, end_date, hidden, paused_at columns.");

const renamed = await client.query(`SELECT 1 FROM pg_enum WHERE enumlabel = 'weekly_term' AND enumtypid = 'cadence_type'::regtype`);
if (renamed.rowCount > 0) {
  await client.query(`ALTER TYPE cadence_type RENAME VALUE 'weekly_term' TO 'school_term'`);
  console.log("Renamed cadence_type value weekly_term -> school_term.");
} else {
  console.log("cadence_type already has no 'weekly_term' value — skipping rename.");
}

const hasEveryNMonths = await client.query(`SELECT 1 FROM pg_enum WHERE enumlabel = 'every_n_months' AND enumtypid = 'cadence_type'::regtype`);
if (hasEveryNMonths.rowCount === 0) {
  await client.query(`ALTER TYPE cadence_type ADD VALUE 'every_n_months'`);
  console.log("Added cadence_type value every_n_months.");
} else {
  console.log("cadence_type already has every_n_months — skipping.");
}

const result = await client.query(
  `UPDATE activity_instances
   SET cadence_config = jsonb_build_object('weekdays', jsonb_build_array(cadence_config->>'weekday'))
   WHERE cadence_type = 'school_term' AND cadence_config ? 'weekday'
   RETURNING id, name, cadence_config`
);
console.log(`Migrated cadenceConfig shape for ${result.rowCount} row(s):`);
for (const r of result.rows) console.log(` - ${r.name}: ${JSON.stringify(r.cadence_config)}`);

await client.end();
