// One-off: the 2026 import wrote "Facilitators (not yet linked to an
// account): X, Y, Z" into each activity's description at import time. Since
// then most of those people have actually been linked (people.link_status
// = 'linked') — the note just never got updated and is now stale/misleading.
// Rewrite each note to only mention names still genuinely pending, in short
// form (first name only), or clear it entirely if none remain.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const activities = await client.query(
  `SELECT id, name, description FROM activity_instances WHERE description LIKE 'Facilitators (not yet linked to an account):%'`
);

for (const a of activities.rows) {
  const names = a.description.replace("Facilitators (not yet linked to an account): ", "").split(",").map((s) => s.trim());
  const statuses = await client.query(`SELECT name, link_status FROM people WHERE name = ANY($1::text[])`, [names]);
  const statusByName = new Map(statuses.rows.map((r) => [r.name, r.link_status]));

  const stillPending = names.filter((n) => statusByName.get(n) === "pending");
  const newDescription = stillPending.length
    ? `Unlinked facilitators: ${stillPending.map((n) => n.split(" ")[0]).join(", ")}`
    : null;

  await client.query(`UPDATE activity_instances SET description = $1 WHERE id = $2`, [newDescription, a.id]);
  console.log(`${a.name}: "${a.description}" -> ${newDescription ? `"${newDescription}"` : "(cleared)"}`);
}

await client.end();
