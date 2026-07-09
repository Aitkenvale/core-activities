// One-off: add the "cancelled" column to attendance_events for the new
// Class Cancelled state — a session the facilitator says never happened,
// distinct from locked/present/absent.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  ALTER TABLE attendance_events
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false
`);
console.log("Ensured attendance_events.cancelled column exists.");

await client.end();
