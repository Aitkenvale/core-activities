import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { households } from "@/db/schema/households";
import { people } from "@/db/schema/people";
import { HouseholdsGrid } from "./HouseholdsGrid";

export default async function AdminHouseholdsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const [allHouseholds, allPeople] = await Promise.all([
    db.select().from(households),
    db.select({ householdId: people.householdId }).from(people),
  ]);

  const peopleCounts = new Map<string, number>();
  for (const p of allPeople) {
    if (!p.householdId) continue;
    peopleCounts.set(p.householdId, (peopleCounts.get(p.householdId) ?? 0) + 1);
  }

  const rows = allHouseholds.map((h) => ({
    id: h.id,
    name: h.name,
    address: h.address,
    notes: h.notes,
    hidden: h.hidden,
    peopleCount: peopleCounts.get(h.id) ?? 0,
  }));

  return <HouseholdsGrid initialRows={rows} />;
}
