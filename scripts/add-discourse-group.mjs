// One-off: add the Discourse Group activity category (its study courses are
// DSA 1 and DSA 2, kept in the existing study-log table under track
// 'discourse', so there's no schema change). Two steps, because the category
// should only appear in the app once the code that understands it — its DSA
// log, role labels and Edit Attendance filter — is live:
//
//   node scripts/add-discourse-group.mjs
//     Inserts the category DISABLED, so it's invisible everywhere (disabled
//     categories are left out of every list). Safe to run at any time.
//
//   node scripts/add-discourse-group.mjs enable
//     AFTER the new code is deployed: switches it on at sort position 5 and
//     moves the (disabled) generic "camp" placeholder down to 6.
//
// Both steps are safe to re-run.
import pg from "pg";

const step = process.argv[2];
if (step !== undefined && step !== "enable") {
  console.error("Usage: node scripts/add-discourse-group.mjs [enable]");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

if (step === undefined) {
  await client.query(`
    INSERT INTO activity_categories (id, label, default_age_min, default_age_max, sort_order, enabled)
    VALUES ('discourse', 'Discourse Group', NULL, NULL, 5, false)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log("Ensured the discourse category exists (a new one is left disabled).");
} else {
  const { rowCount } = await client.query(`SELECT 1 FROM activity_categories WHERE id = 'discourse'`);
  if (!rowCount) {
    console.error("Run this without 'enable' first — the category row isn't there yet.");
    await client.end();
    process.exit(1);
  }
  await client.query(`UPDATE activity_categories SET label = 'Discourse Group', sort_order = 5, enabled = true WHERE id = 'discourse'`);
  await client.query(`UPDATE activity_categories SET sort_order = 6 WHERE id = 'camp'`);
  console.log("Enabled the discourse category (sort 5); camp placeholder moved to sort 6.");
}

await client.end();
