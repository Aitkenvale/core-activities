import pg from "pg";

const oldClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
const newClient = new pg.Client({ connectionString: process.env.NEW_DATABASE_URL });
await oldClient.connect();
await newClient.connect();

const tables = [
  "households", "people", "guardian_relationships", "activity_categories",
  "neighbourhoods", "term_dates", "activity_instances", "activity_facilitators",
  "activity_enrollments", "attendance_events", "attendance_records",
  "user", "session", "account", "passkey", "verification",
];

for (const t of tables) {
  const oldCount = await oldClient.query(`SELECT count(*) FROM ${t}`);
  const newCount = await newClient.query(`SELECT count(*) FROM ${t}`);
  const match = oldCount.rows[0].count === newCount.rows[0].count ? "OK" : "MISMATCH";
  console.log(t.padEnd(24), "old:", oldCount.rows[0].count, " new:", newCount.rows[0].count, match);
}

await oldClient.end();
await newClient.end();
