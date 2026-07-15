// One-off: create activity_enrollment_role_history (append-only log of
// when a Facilitator/Assistant's role changed) and backfill one row per
// current facilitator/assistant enrollment, so the Attendance Records PDF
// can look up "what was their role on this session date" instead of just
// "what's their role today".
//
// Backfill assumption (confirmed with the user): every current role is
// correct as of 2026-01-01 onward — covers all of 2026 Q1-Q3, which is
// everything reportable so far. Going forward, changeEnrollmentRole
// records a real new row each time a role actually changes.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS activity_enrollment_role_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES activity_enrollments(id) ON DELETE CASCADE,
    role enrollment_role NOT NULL,
    effective_from date NOT NULL,
    recorded_by_user_id text REFERENCES "user"(id),
    recorded_at timestamptz NOT NULL DEFAULT now()
  )
`);
console.log("Created activity_enrollment_role_history table.");

const { rows: existing } = await client.query(`SELECT COUNT(*)::int AS count FROM activity_enrollment_role_history`);
if (existing[0].count > 0) {
  console.log(`Table already has ${existing[0].count} row(s) — skipping backfill (safe to re-run, but won't duplicate).`);
} else {
  const { rowCount } = await client.query(`
    INSERT INTO activity_enrollment_role_history (enrollment_id, role, effective_from)
    SELECT id, role, '2026-01-01'
    FROM activity_enrollments
    WHERE role IN ('facilitator', 'assistant')
  `);
  console.log(`Backfilled ${rowCount} history row(s) from current facilitator/assistant enrollments.`);
}

await client.end();
