// One-off: upload every registration form PDF from the shared Forms/ folder
// to Vercel Blob (private access), under forms/<original filename>.
// addRandomSuffix:false keeps the pathname stable and predictable, so this
// script is safe to re-run (re-uploading a file just overwrites the same
// blob) and the admin review tool can match by filename.
import { readdirSync, readFileSync } from "fs";
import { put } from "@vercel/blob";

const FORMS_DIR =
  "/Users/michaelcohen/Library/CloudStorage/OneDrive-SharedLibraries-NSAoftheBahaisofAustralia/Aitkenvale Neighbourhood - General/Resources/Code/Forms";

const files = readdirSync(FORMS_DIR).filter((f) => f.endsWith(".pdf"));
console.log(`Found ${files.length} PDF(s) to upload.`);

let uploaded = 0;
let failed = 0;
for (const filename of files) {
  try {
    const buffer = readFileSync(`${FORMS_DIR}/${filename}`);
    const result = await put(`forms/${filename}`, buffer, {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/pdf",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    uploaded++;
    console.log(`✓ ${filename} -> ${result.pathname}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${filename}:`, e instanceof Error ? e.message : e);
  }
}

console.log(`\nDone. ${uploaded} uploaded, ${failed} failed.`);
