// One-off: add Ruhi Camps. Creates ruhi_unit_progress (a person's Ruhi study
// log — one row per book/unit they've started or finished, "not studied"
// being the absence of a row) and adds the "ruhi" activity category.
// Additive and safe to re-run. The generic "camp" placeholder (disabled) is
// left alone apart from being nudged down one sort slot to make room.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  DO $$ BEGIN
    CREATE TYPE ruhi_unit_status AS ENUM ('partial', 'complete');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$
`);

await client.query(`
  CREATE TABLE IF NOT EXISTS ruhi_unit_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    book smallint NOT NULL,
    unit smallint NOT NULL,
    status ruhi_unit_status NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id text REFERENCES "user"(id),
    UNIQUE (person_id, book, unit)
  )
`);
console.log("Ensured ruhi_unit_progress table.");

await client.query(`
  INSERT INTO activity_categories (id, label, default_age_min, default_age_max, sort_order, enabled)
  VALUES ('ruhi', 'Ruhi Camp', NULL, NULL, 4, true)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, enabled = EXCLUDED.enabled
`);
await client.query(`UPDATE activity_categories SET sort_order = 5 WHERE id = 'camp'`);
console.log("Ensured the ruhi activity category (sort 4, enabled); camp placeholder moved to sort 5.");

await client.end();
