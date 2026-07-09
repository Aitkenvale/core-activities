// One-off: add households.contact_person_id (nullable FK to people.id).
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`ALTER TABLE households ADD COLUMN IF NOT EXISTS contact_person_id uuid REFERENCES people(id)`);
console.log("Added contact_person_id column to households.");

await client.end();
