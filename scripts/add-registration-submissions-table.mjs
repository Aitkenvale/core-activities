// One-off: create registration_submissions — the immutable log of every
// public /register submission, kept separate from the People/Household
// rows it creates (which get edited/merged over time).
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS registration_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_at timestamptz NOT NULL DEFAULT now(),
    language text NOT NULL,
    raw_data jsonb NOT NULL,
    consent_given boolean NOT NULL,
    guardian_confirmed boolean NOT NULL,
    household_id uuid REFERENCES households(id),
    created_person_ids jsonb NOT NULL
  )
`);
console.log("Created registration_submissions table.");

await client.end();
