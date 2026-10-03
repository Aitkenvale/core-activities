// One-off: turn ruhi_unit_progress into the study log for every track — Ruhi
// (books x units), Children's Grades, Junior Youth Texts — by adding a `track`
// column. The existing rows are all Ruhi's and pick up 'ruhi' from the column
// default; nothing is rewritten. The table keeps its original name (renaming
// it would break the code that is live while this ships); its `book` column
// now holds whichever row number the track uses (a book, a grade or a text)
// and `unit` is always 1 for the tracks that have no units.
//
// Production is live, so this runs in two phases:
//
//   node scripts/add-study-tracks.mjs expand
//     BEFORE pushing the new code. Adds `track` and a unique index that
//     includes it. Safe for the code that is live right now: its inserts get
//     track = 'ruhi' from the default, and its ON CONFLICT (person_id, book,
//     unit) still has the old constraint to match.
//
//   node scripts/add-study-tracks.mjs contract
//     AFTER the new code is deployed. Drops that old constraint, which would
//     otherwise make Grade 1 collide with Book 1 Unit 1 for the same person.
//
// Both phases are safe to re-run.
import pg from "pg";

const phase = process.argv[2];
if (phase !== "expand" && phase !== "contract") {
  console.error("Usage: node scripts/add-study-tracks.mjs expand|contract");
  process.exit(1);
}

const NEW_INDEX = "ruhi_unit_progress_person_track_book_unit_key";
const OLD_CONSTRAINT = "ruhi_unit_progress_person_id_book_unit_key";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

if (phase === "expand") {
  await client.query(`ALTER TABLE ruhi_unit_progress ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'ruhi'`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${NEW_INDEX} ON ruhi_unit_progress (person_id, track, book, unit)`);
  const { rows } = await client.query(`SELECT track, count(*)::int AS rows FROM ruhi_unit_progress GROUP BY track ORDER BY track`);
  console.log("Expanded: track column and unique index in place. Rows by track:", JSON.stringify(rows));
} else {
  // Never drop the old rule unless the one that replaces it is already there.
  const { rows: index } = await client.query(`SELECT 1 FROM pg_indexes WHERE tablename = 'ruhi_unit_progress' AND indexname = '${NEW_INDEX}'`);
  if (index.length === 0) {
    console.error("Run 'expand' first — the new unique index isn't in place yet.");
    await client.end();
    process.exit(1);
  }
  await client.query(`ALTER TABLE ruhi_unit_progress DROP CONSTRAINT IF EXISTS ${OLD_CONSTRAINT}`);
  console.log("Contracted: dropped the old (person_id, book, unit) unique constraint.");
}

await client.end();
