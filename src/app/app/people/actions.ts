"use server";

import { headers } from "next/headers";
import { and, eq, ilike, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in");
}

// Hidden people don't show up here — same convention as every other person
// search in the app.
export async function searchPeopleDirectory(query: string) {
  await requireSession();
  const q = query.trim();
  if (q.length < 2) return [];
  return db
    .select({
      id: people.id,
      name: people.name,
      preferredName: people.preferredName,
      householdName: households.name,
      mobile: people.mobile,
      email: people.email,
    })
    .from(people)
    .leftJoin(households, eq(households.id, people.householdId))
    .where(and(eq(people.hidden, false), or(ilike(people.name, `%${q}%`), ilike(people.preferredName, `%${q}%`))))
    .limit(20);
}
