// One-off: backfills people.regoYear from the REGO column (index 6) in the
// original PSEC/JYSEP CSVs — only meaningful where a real 4-digit year is
// present (skips blank/"NA"/"TRUE"/"FALSE").
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { people } from "../schema/people";

const BASE =
  "/Users/michaelcohen/Library/CloudStorage/OneDrive-SharedLibraries-NSAoftheBahaisofAustralia/Aitkenvale Neighbourhood - General/Resources/Code";

function readCsv(filename: string): string[][] {
  const raw = fs.readFileSync(`${BASE}/${filename}`, "utf-8");
  return parse(raw, { columns: false, skip_empty_lines: false, relax_column_count: true }) as string[][];
}

async function backfill(filename: string) {
  const rows = readCsv(filename).slice(3);
  let updated = 0;
  for (const row of rows) {
    const name = (row[2] || "").trim();
    const regoRaw = (row[6] || "").trim();
    if (!name) continue;
    const m = regoRaw.match(/^(20\d{2})$/);
    if (!m) continue;
    const regoYear = Number(m[1]);

    const [person] = await db.select().from(people).where(eq(people.name, name));
    if (!person) continue;

    await db.update(people).set({ regoYear }).where(eq(people.id, person.id));
    updated++;
  }
  console.log(`${filename}: ${updated} people given a rego year`);
}

async function main() {
  await backfill("People & Attendance 2026 - PSEC.csv");
  await backfill("People & Attendance 2026 - JYSEP.csv");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
