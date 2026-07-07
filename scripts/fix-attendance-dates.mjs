// One-off correction: the 2026 import used the source sheet's week-anchor
// dates (always Monday) directly as each session's date, instead of
// offsetting to that activity's actual meeting weekday. Fixes bulk-imported
// events only (was_generated_from_cadence = true) — anything created live
// through the app was already computed correctly and must not be touched.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const OFFSETS = [
  { names: ["Aitkenvale — Tuesday — Grade 1", "Aitkenvale — Tuesday — Grade 2", "Aitkenvale — Tuesday — Grade 3", "Aitkenvale — Tuesday — Grade 4"], days: 1 },
  { names: ["Aitkenvale — Yas — Saturday"], days: 5 },
  // Monday-cadence groups need no shift (anchor date already matches):
  // Aitkenvale — Jarrah & Naisan, Aitkenvale — Melanie, Aitkenvale — Vrinda, Aitkenvale — Zorion
];

// Remove the one known live-test event (3 exploratory marks, not real data)
// before shifting, since the corrected date would collide with it.
const deleted = await client.query(
  `DELETE FROM attendance_events
   WHERE was_generated_from_cadence = false AND session_date = '2026-06-16'
     AND activity_instance_id = (SELECT id FROM activity_instances WHERE name = 'Aitkenvale — Tuesday — Grade 2')
   RETURNING id`
);
console.log(`Removed ${deleted.rowCount} live-test event(s) that would conflict with the corrected date.`);

for (const { names, days } of OFFSETS) {
  const result = await client.query(
    `UPDATE attendance_events
     SET session_date = session_date + ($1 || ' days')::interval
     WHERE was_generated_from_cadence = true
       AND activity_instance_id IN (SELECT id FROM activity_instances WHERE name = ANY($2::text[]))
     RETURNING id`,
    [days, names]
  );
  console.log(`+${days} day(s) applied to ${result.rowCount} events for: ${names.join(", ")}`);
}

await client.end();
