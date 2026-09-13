import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";

// A phone photo of a paper form can run several MB (more for a multi-shot
// PDF export) — capped generously rather than tightly, since rejecting a
// real photo is worse than a slightly bigger private Blob file.
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

// Not a strict allowlist — accept="image/*,application/pdf" on the input
// already steers the picker, and some mobile browsers report an empty or
// unexpected `type` for a camera capture. Only reject a `type` that's
// clearly neither, rather than trying to enumerate every valid MIME string.
function isAcceptableType(type: string): boolean {
  return type === "" || type.startsWith("image/") || type === "application/pdf";
}

function extensionFor(type: string): string {
  if (type === "application/pdf") return "pdf";
  const sub = type.split("/")[1];
  return sub || "jpg";
}

// Shared by every surface that can attach a registration form/photo to a
// person (Admin People, the general People Edit form, and the Attendance
// Add Info modal) — each has its own "use server" action file with its own
// permission gate, but they all funnel into this one upload+link step.
export async function uploadPersonRegoForm(personId: string, file: File): Promise<string> {
  if (!file || file.size === 0) throw new Error("No file was selected.");
  if (file.size > MAX_SIZE_BYTES) throw new Error("That file is too large (max 20MB).");
  if (!isAcceptableType(file.type)) throw new Error("Only a photo or a PDF can be linked here.");

  const blob = await put(`rego-forms/${personId}-${Date.now()}.${extensionFor(file.type)}`, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.type || undefined,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  await db.update(people).set({ regoFormUrl: blob.url }).where(eq(people.id, personId));
  return blob.url;
}
