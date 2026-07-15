import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { activityInstances } from "@/db/schema/activityInstances";
import { PeopleGrid } from "./PeopleGrid";

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");
  const { q } = await searchParams;

  const householdContacts = alias(people, "household_contacts");
  const [rows, contactRows, participantRows] = await Promise.all([
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
        regoFormUrl: people.regoFormUrl,
        hidden: people.hidden,
        linkStatus: people.linkStatus,
        comment: people.comment,
        householdContactPersonId: households.contactPersonId,
        householdContactName: householdContacts.name,
        householdContactPreferredName: householdContacts.preferredName,
        householdContactMobile: householdContacts.mobile,
      })
      .from(people)
      .leftJoin(households, eq(households.id, people.householdId))
      .leftJoin(householdContacts, eq(householdContacts.id, households.contactPersonId)),
    db.select({ contactPersonId: households.contactPersonId }).from(households),
    // "Current participant" — actively on an activity's roster as a
    // participant (not facilitator), and that activity isn't Complete
    // (archived). Drives the Participants filter dropdown.
    db
      .select({ personId: activityEnrollments.personId })
      .from(activityEnrollments)
      .innerJoin(activityInstances, eq(activityInstances.id, activityEnrollments.activityInstanceId))
      .where(and(eq(activityEnrollments.role, "participant"), eq(activityEnrollments.active, true), ne(activityInstances.status, "archived"))),
  ]);

  const contactPersonIds = new Set(contactRows.map((h) => h.contactPersonId).filter((id): id is string => id !== null));
  const currentParticipantIds = new Set(participantRows.map((p) => p.personId));
  const rowsWithFlags = rows.map((r) => ({
    ...r,
    isHouseholdContact: contactPersonIds.has(r.id),
    isCurrentParticipant: currentParticipantIds.has(r.id),
  }));

  return <PeopleGrid initialRows={rowsWithFlags} initialFilter={q ?? ""} />;
}
