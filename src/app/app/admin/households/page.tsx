import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { households } from "@/db/schema/households";
import { people } from "@/db/schema/people";
import { HouseholdsGrid } from "./HouseholdsGrid";

export default async function AdminHouseholdsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");
  const { q } = await searchParams;

  const [allHouseholds, allPeople] = await Promise.all([
    db.select().from(households),
    db.select({ id: people.id, householdId: people.householdId, name: people.name, preferredName: people.preferredName, mobile: people.mobile }).from(people),
  ]);

  const peopleCounts = new Map<string, number>();
  for (const p of allPeople) {
    if (!p.householdId) continue;
    peopleCounts.set(p.householdId, (peopleCounts.get(p.householdId) ?? 0) + 1);
  }
  const peopleById = new Map(allPeople.map((p) => [p.id, p]));

  const rows = allHouseholds.map((h) => {
    const contact = h.contactPersonId ? peopleById.get(h.contactPersonId) : undefined;
    return {
      id: h.id,
      name: h.name,
      address: h.address,
      notes: h.notes,
      hidden: h.hidden,
      peopleCount: peopleCounts.get(h.id) ?? 0,
      contactPersonId: h.contactPersonId,
      contactName: contact?.name ?? null,
      contactPreferredName: contact?.preferredName ?? null,
      contactMobile: contact?.mobile ?? null,
    };
  });

  return <HouseholdsGrid initialRows={rows} initialFilter={q ?? ""} />;
}
