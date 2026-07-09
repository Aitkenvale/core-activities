// One-off: create the allowed_signups table and seed it from the current
// SIGNUP_ALLOWED_EMAILS/ADMIN_EMAILS env vars, so existing invites aren't
// lost when Settings > Users takes over from those env vars. Skips anyone
// who has already signed up (they show up in the real `user` table with an
// editable role instead).
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS allowed_signups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    is_admin boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`);
console.log("Ensured allowed_signups table exists.");

function parseEmailList(value) {
  return (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const signupAllowed = parseEmailList(process.env.SIGNUP_ALLOWED_EMAILS);
const adminEmails = new Set(parseEmailList(process.env.ADMIN_EMAILS));

const { rows: existingUsers } = await client.query(`SELECT email FROM "user"`);
const alreadySignedUp = new Set(existingUsers.map((u) => u.email.toLowerCase()));

let seeded = 0;
for (const email of signupAllowed) {
  if (alreadySignedUp.has(email)) continue;
  const result = await client.query(
    `INSERT INTO allowed_signups (name, email, is_admin) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING email`,
    [email, email, adminEmails.has(email)],
  );
  if (result.rowCount) seeded++;
}
console.log(`Seeded ${seeded} pending invite(s) (name defaulted to email — edit in Settings > Users).`);

await client.end();
