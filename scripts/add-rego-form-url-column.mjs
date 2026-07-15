// One-off: add people.rego_form_url (nullable text) — a link to the
// person's scanned/uploaded registration form document.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`ALTER TABLE people ADD COLUMN IF NOT EXISTS rego_form_url text`);
console.log("Added rego_form_url column to people.");

await client.end();
