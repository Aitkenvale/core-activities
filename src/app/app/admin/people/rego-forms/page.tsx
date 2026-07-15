import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { list } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { RegoFormsReview } from "./RegoFormsReview";

// One-time cleanup tool for the ~110 registration forms bulk-uploaded to
// Blob storage (scripts/upload-forms-to-blob.mjs) — matching filenames to
// People automatically isn't safe here (several first names are shared by
// 2-3 different people), so this presents a best-guess per file and
// requires an admin to actually confirm each link.
export default async function RegoFormsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const [{ blobs }, peopleRows] = await Promise.all([
    list({ prefix: "forms/", token: process.env.BLOB_READ_WRITE_TOKEN }),
    db
      .select({
        id: people.id,
        name: people.name,
        preferredName: people.preferredName,
        dob: people.dob,
        householdName: households.name,
        regoFormUrl: people.regoFormUrl,
      })
      .from(people)
      .leftJoin(households, eq(households.id, people.householdId))
      .where(eq(people.hidden, false)),
  ]);

  const linkedUrls = new Set(peopleRows.map((p) => p.regoFormUrl).filter((u): u is string => u !== null));
  const pendingForms = blobs
    .filter((b) => !linkedUrls.has(b.url))
    .map((b) => ({ url: b.url, filename: b.pathname.replace(/^forms\//, ""), size: b.size }));

  return <RegoFormsReview forms={pendingForms} people={peopleRows} linkedCount={linkedUrls.size} />;
}
