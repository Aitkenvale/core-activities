// One-off: undo an accidental merge. "Laurent" (quick-added in Richard St —
// Grade 3, hidden as "Laurent of Yacinthe" after the merge) was mistakenly
// linked to "Laurent Kisito" (a real Grade 4 student, unrelated). This moves
// the Grade 3 enrollment + its 19 attendance records back off Laurent Kisito
// and onto the original pending person, then un-hides them — leaving
// Laurent Kisito's own real Grade 4 history (20 records) untouched.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const KISITO_ID = "1d31f844-b9ee-4991-a3c0-189d5909a752";
const PENDING_ID = "ddba2df8-1d5d-49c2-bf34-44ee9ef32df7"; // "Laurent of Yacinthe"
const GRADE3_ID = "cf96f650-42ce-4da8-a94c-d5df254303be"; // Richard St — Grade 3

const enr = await client.query(
  `UPDATE activity_enrollments SET person_id = $1
   WHERE person_id = $2 AND activity_instance_id = $3
   RETURNING id`,
  [PENDING_ID, KISITO_ID, GRADE3_ID],
);
console.log(`Moved ${enr.rowCount} enrollment row(s) back to the pending person.`);

const records = await client.query(
  `UPDATE attendance_records SET person_id = $1
   WHERE person_id = $2
     AND attendance_event_id IN (SELECT id FROM attendance_events WHERE activity_instance_id = $3)
   RETURNING id`,
  [PENDING_ID, KISITO_ID, GRADE3_ID],
);
console.log(`Moved ${records.rowCount} attendance record(s) back to the pending person.`);

const unhidden = await client.query(`UPDATE people SET hidden = false WHERE id = $1 RETURNING name, hidden`, [PENDING_ID]);
console.log("Un-hid:", unhidden.rows[0]);

// Sanity check: confirm Laurent Kisito's Grade 4 history is untouched.
const kisitoAfter = await client.query(
  `SELECT ai.name, count(*) FROM attendance_records ar
   JOIN attendance_events aev ON aev.id = ar.attendance_event_id
   JOIN activity_instances ai ON ai.id = aev.activity_instance_id
   WHERE ar.person_id = $1 GROUP BY ai.name`,
  [KISITO_ID],
);
console.log("Laurent Kisito's attendance records after the fix (should be Grade 4 only):", kisitoAfter.rows);

await client.end();
