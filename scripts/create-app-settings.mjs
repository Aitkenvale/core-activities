// One-off: create the app_settings key/value table and seed the current
// hardcoded edit-window value, so it becomes admin-editable via Settings.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`);
console.log("Ensured app_settings table exists.");

const result = await client.query(
  `INSERT INTO app_settings (key, value) VALUES ('non_admin_edit_window_months', '3')
   ON CONFLICT (key) DO NOTHING
   RETURNING key, value`
);
console.log(result.rowCount ? `Seeded ${result.rows[0].key} = ${result.rows[0].value}` : "non_admin_edit_window_months already existed — left as-is.");

await client.end();
