// One-off: add "assistant" as a new value on the enrollment_role enum,
// alongside the existing "participant"/"facilitator" — Facilitators now
// split into Facilitators (require child protection training) and
// Assistants (don't). Postgres enums only support adding values, never
// removing/reordering, so this is additive and safe to run more than once.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`ALTER TYPE enrollment_role ADD VALUE IF NOT EXISTS 'assistant'`);
console.log("Added 'assistant' to the enrollment_role enum.");

await client.end();
