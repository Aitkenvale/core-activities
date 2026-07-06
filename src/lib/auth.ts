import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/users";

// Resolves the signed-in Clerk identity to a local `users` row, creating one
// (default role: facilitator) on first sign-in. The very first admin must be
// promoted by hand — see README "Bootstrapping the first admin".
export async function getOrCreateAppUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUser.id),
  });
  if (existing) return existing;

  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Unnamed";
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? null;

  const [created] = await db
    .insert(users)
    .values({ clerkUserId: clerkUser.id, name, email })
    .returning();

  return created;
}
