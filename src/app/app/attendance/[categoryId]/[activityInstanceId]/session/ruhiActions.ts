"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { assertValidRuhiCell, isRuhiUnitStatus, type RuhiUnitStatus } from "@/lib/ruhi";
import { listRuhiProgress, saveRuhiUnitStatus, type RuhiProgressEntry } from "@/lib/ruhiProgress";

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in");
  return session.user.id;
}

// Open to any signed-in user, same as taking attendance itself — and
// deliberately not subject to a session's Confirmed/Cancelled state or the
// edit window: the log belongs to the person, not to any one session date.
export async function getRuhiProgress(personIds: string[]): Promise<RuhiProgressEntry[]> {
  await requireUserId();
  return listRuhiProgress(personIds);
}

export async function setRuhiUnitStatus(personId: string, book: number, unit: number, status: RuhiUnitStatus) {
  const userId = await requireUserId();
  assertValidRuhiCell(book, unit);
  if (!isRuhiUnitStatus(status)) throw new Error("Invalid status.");
  await saveRuhiUnitStatus(userId, personId, book, unit, status);
}
