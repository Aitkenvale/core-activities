import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { PeopleGrid } from "./PeopleGrid";

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");
  const { q } = await searchParams;

  const [rows, contactRows] = await Promise.all([
    db
      .select({
        id: people.id,
        name: people.name,
        preferredName: people.preferredName,
        householdId: people.householdId,
        householdName: households.name,
        dob: people.dob,
        mobile: people.mobile,
        email: people.email,
        regoYear: people.regoYear,
        hidden: people.hidden,
        linkStatus: people.linkStatus,
        comment: people.comment,
      })
      .from(people)
      .leftJoin(households, eq(households.id, people.householdId)),
    db.select({ contactPersonId: households.contactPersonId }).from(households),
  ]);

  const contactPersonIds = new Set(contactRows.map((h) => h.contactPersonId).filter((id): id is string => id !== null));
  const rowsWithContactFlag = rows.map((r) => ({ ...r, isHouseholdContact: contactPersonIds.has(r.id) }));

  return <PeopleGrid initialRows={rowsWithContactFlag} initialFilter={q ?? ""} />;
}
