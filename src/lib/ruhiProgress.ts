// Server-only: the actual reads/writes behind the Ruhi study log. Kept out of
// the "use server" action files so it can be shared by the person-merge and
// person-delete actions too, without becoming directly callable from the
// client. Never import this from a client component (src/lib/ruhi.ts is the
// client-safe half).
import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { ruhiUnitProgress } from "@/db/schema/ruhiUnitProgress";
import type { RuhiUnitStatus, StoredRuhiUnitStatus } from "@/lib/ruhi";

export type RuhiProgressEntry = { personId: string; book: number; unit: number; status: StoredRuhiUnitStatus };

export async function listRuhiProgress(personIds: string[]): Promise<RuhiProgressEntry[]> {
  if (personIds.length === 0) return [];
  return db
    .select({
      personId: ruhiUnitProgress.personId,
      book: ruhiUnitProgress.book,
      unit: ruhiUnitProgress.unit,
      status: ruhiUnitProgress.status,
    })
    .from(ruhiUnitProgress)
    .where(inArray(ruhiUnitProgress.personId, personIds));
}

// Absolute state, not "cycle" — the client works out the next state, this
// just records it. "none" deletes the row (not studied is the absence of
// one), anything else upserts.
export async function saveRuhiUnitStatus(userId: string, personId: string, book: number, unit: number, status: RuhiUnitStatus) {
  if (status === "none") {
    await db
      .delete(ruhiUnitProgress)
      .where(and(eq(ruhiUnitProgress.personId, personId), eq(ruhiUnitProgress.book, book), eq(ruhiUnitProgress.unit, unit)));
    return;
  }
  await db
    .insert(ruhiUnitProgress)
    .values({ personId, book, unit, status, updatedByUserId: userId })
    .onConflictDoUpdate({
      target: [ruhiUnitProgress.personId, ruhiUnitProgress.book, ruhiUnitProgress.unit],
      set: { status, updatedByUserId: userId, updatedAt: new Date() },
    });
}

export async function hasRuhiProgress(personId: string): Promise<boolean> {
  const [row] = await db.select({ id: ruhiUnitProgress.id }).from(ruhiUnitProgress).where(eq(ruhiUnitProgress.personId, personId)).limit(1);
  return Boolean(row);
}

// Folds one person's Ruhi log onto another's for a person merge. Per cell,
// whichever of the two has got further wins (complete beats partial beats
// nothing), then the source's rows are dropped. Not in a transaction (the
// neon-http driver has none), but every step is safe to re-run, same as the
// rest of the merge code.
export async function mergeRuhiProgress(fromPersonId: string, toPersonId: string) {
  // The survivor only has a cell partly, the other person has it done.
  await db.execute(sql`
    UPDATE ruhi_unit_progress AS t
    SET status = 'complete', updated_at = now()
    FROM ruhi_unit_progress AS f
    WHERE t.person_id = ${toPersonId}
      AND f.person_id = ${fromPersonId}
      AND t.book = f.book
      AND t.unit = f.unit
      AND t.status = 'partial'
      AND f.status = 'complete'
  `);

  // Cells the survivor has no row for at all move across as they are.
  const target = alias(ruhiUnitProgress, "ruhi_target");
  await db
    .update(ruhiUnitProgress)
    .set({ personId: toPersonId })
    .where(
      and(
        eq(ruhiUnitProgress.personId, fromPersonId),
        notExists(
          db
            .select()
            .from(target)
            .where(and(eq(target.personId, toPersonId), eq(target.book, ruhiUnitProgress.book), eq(target.unit, ruhiUnitProgress.unit))),
        ),
      ),
    );

  // Whatever's left is a cell the survivor already has at least as far along.
  await db.delete(ruhiUnitProgress).where(eq(ruhiUnitProgress.personId, fromPersonId));
}
