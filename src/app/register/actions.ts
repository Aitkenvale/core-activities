"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { households } from "@/db/schema/households";
import { people } from "@/db/schema/people";
import { registrationSubmissions } from "@/db/schema/registrationSubmissions";

export type RegistrationChild = { name: string; dob: string; hasHealth: boolean; health: string };
export type RegistrationParent = { name: string; address: string; mobile: string; email: string };

// Reasonable caps for a real family, not a rate limiter — this is the
// app's only genuinely public write (no signed-in user at all, since a
// parent has no account), and there's no request-throttling infra to lean
// on at zero budget. Keeps a scripted/malicious payload from turning into
// an unbounded insert loop; doesn't stop someone from calling this
// repeatedly, which is an accepted trade-off at this budget.
const MAX_CHILDREN = 10;
const MAX_PARENTS = 5;

// "Alex family" / "Alex & Sam family" / "Alex, Sam & Jo family" — same
// naming convention as the old Apps Script sheets-script.gs.
function buildHouseholdName(parentNames: string[]): string {
  const firstNames = parentNames.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean);
  if (firstNames.length === 0) return "New family";
  if (firstNames.length === 1) return `${firstNames[0]} family`;
  if (firstNames.length === 2) return `${firstNames[0]} & ${firstNames[1]} family`;
  const last = firstNames.pop()!;
  return `${firstNames.join(", ")} & ${last} family`;
}

// Every value is re-validated here regardless of what the client already
// checked — nothing from an anonymous submitter is trusted as-is. Always
// creates a brand-new household + people, never matched against existing
// records (the same reasoning as the Forms/ filename-matching problem —
// guessing wrong here means attaching a child to the wrong family). They
// land as linkStatus "pending", source "registration_form" — the same
// status a facilitator's quick-add already gets — so an admin reconciles
// duplicates via the existing People grid / merge tooling, not something
// bespoke.
export async function submitRegistration(input: {
  language: "en" | "fr";
  children: RegistrationChild[];
  parents: RegistrationParent[];
  consentGiven: boolean;
  guardianConfirmed: boolean;
}): Promise<{ householdId: string }> {
  const children = (input.children ?? []).filter((c) => c && typeof c.name === "string" && typeof c.dob === "string").slice(0, MAX_CHILDREN);
  const parents = (input.parents ?? []).filter((p) => p && typeof p.name === "string").slice(0, MAX_PARENTS);

  if (children.length === 0) throw new Error("At least one child is required.");
  if (parents.length === 0) throw new Error("At least one parent/guardian is required.");
  for (const c of children) {
    if (!c.name.trim()) throw new Error("Every child needs a name.");
    if (!c.dob || !/^\d{4}-\d{2}-\d{2}$/.test(c.dob)) throw new Error("Every child needs a valid date of birth.");
  }
  for (const p of parents) {
    if (!p.name?.trim()) throw new Error("Every parent/guardian needs a name.");
    if (!p.mobile?.trim()) throw new Error("Every parent/guardian needs a mobile number.");
    if (!p.address?.trim()) throw new Error("Every parent/guardian needs an address.");
    if (p.email && !/\S+@\S+\.\S+/.test(p.email)) throw new Error("That email address doesn't look right.");
  }
  if (!input.consentGiven) throw new Error("All permissions must be accepted.");
  if (!input.guardianConfirmed) throw new Error("Please confirm your parent/guardian status.");

  const [household] = await db
    .insert(households)
    .values({ name: buildHouseholdName(parents.map((p) => p.name)), address: parents[0].address.trim() })
    .returning({ id: households.id });

  const createdPersonIds: string[] = [];
  let firstParentId: string | null = null;
  for (const p of parents) {
    const [created] = await db
      .insert(people)
      .values({
        householdId: household.id,
        name: p.name.trim(),
        personType: "adult",
        mobile: p.mobile.trim(),
        email: p.email?.trim() || null,
        linkStatus: "pending",
        source: "registration_form",
      })
      .returning({ id: people.id });
    createdPersonIds.push(created.id);
    if (!firstParentId) firstParentId = created.id;
  }

  // regoYear — "the year a parent/guardian signed the registration form
  // for the person's current program stage" (people.ts) — this submission
  // is exactly that, for every child on it.
  const thisYear = new Date().getFullYear();
  for (const c of children) {
    const [created] = await db
      .insert(people)
      .values({
        householdId: household.id,
        name: c.name.trim(),
        personType: "child",
        dob: c.dob,
        healthNotes: c.hasHealth ? c.health?.trim() || "Yes" : null,
        regoYear: thisYear,
        linkStatus: "pending",
        source: "registration_form",
      })
      .returning({ id: people.id });
    createdPersonIds.push(created.id);
  }

  // First parent listed becomes the household's contact, matching how
  // every other part of the app treats "who to call about this kid".
  if (firstParentId) {
    await db.update(households).set({ contactPersonId: firstParentId }).where(eq(households.id, household.id));
  }

  await db.insert(registrationSubmissions).values({
    language: input.language,
    rawData: { children, parents },
    consentGiven: input.consentGiven,
    guardianConfirmed: input.guardianConfirmed,
    householdId: household.id,
    createdPersonIds,
  });

  return { householdId: household.id };
}
