// One-off: lock every attendance event whose session date is in the past,
// so historical rolls can't be edited by accident. Going forward this is
// reinforced by a standing rule (non-admins can't edit sessions older than
// 3 months, regardless of this locked flag) — see actions.ts.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const result = await client.query(
  `UPDATE attendance_events
   SET locked = true
   WHERE session_date < CURRENT_DATE AND locked = false
   RETURNING id`
);
console.log(`Locked ${result.rowCount} past event(s).`);

await client.end();
