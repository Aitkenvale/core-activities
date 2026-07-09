import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { PeopleGrid } from "./PeopleGrid";

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");
  const { q } = await searchParams;

  const [rows, enrolledPersonIds] = await Promise.all([
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
    // Linked/Pending only means anything for someone who's actually been
    // rostered onto an activity at some point — for everyone else (most
    // people, bulk-imported or admin-added) it's just an inert default,
    // so the grid hides it entirely rather than showing a meaningless "Linked".
    db.selectDistinct({ personId: activityEnrollments.personId }).from(activityEnrollments),
  ]);

  const enrolledSet = new Set(enrolledPersonIds.map((r) => r.personId));
  const rowsWithEnrollment = rows.map((r) => ({ ...r, hasEnrollment: enrolledSet.has(r.id) }));

  return <PeopleGrid initialRows={rowsWithEnrollment} initialFilter={q ?? ""} />;
}
