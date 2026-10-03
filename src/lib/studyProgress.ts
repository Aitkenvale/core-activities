// Server-only: the actual reads/writes behind the study logs (Ruhi Units,
// Grades, Texts). Kept out of the "use server" action files so it can be
// shared by the person-merge and person-delete actions too, without becoming
// directly callable from the client. Never import this from a client
// component (src/lib/studyTracks.ts is the client-safe half).
import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { studyProgress } from "@/db/schema/studyProgress";
import { communityToday } from "@/lib/studyDate";
import type { StoredStudyStatus, StudyStatus, StudyTrackId } from "@/lib/studyTracks";

export type StudyProgressEntry = { personId: string; item: number; unit: number; status: StoredStudyStatus };

export async function listStudyProgress(track: StudyTrackId, personIds: string[]): Promise<StudyProgressEntry[]> {
  if (personIds.length === 0) return [];
  return db
    .select({
      personId: studyProgress.personId,
      item: studyProgress.item,
      unit: studyProgress.unit,
      status: studyProgress.status,
    })
    .from(studyProgress)
    .where(and(eq(studyProgress.track, track), inArray(studyProgress.personId, personIds)));
}

export type StudyProgressRow = StudyProgressEntry & { track: string };

// Everyone's log across every track at once, for the admin Edit Courses grid.
export async function listAllStudyProgress(): Promise<StudyProgressRow[]> {
  return db
    .select({
      personId: studyProgress.personId,
      track: studyProgress.track,
      item: studyProgress.item,
      unit: studyProgress.unit,
      status: studyProgress.status,
    })
    .from(studyProgress);
}

// Everyone who isn't hidden and has at least one box in any study log, for the
// admin Course Report — the people the report can possibly list, so the page
// doesn't ship the whole directory to the browser.
export async function listPeopleWithStudyProgress() {
  return db
    .selectDistinct({ id: people.id, name: people.name, preferredName: people.preferredName, dob: people.dob })
    .from(people)
    .innerJoin(studyProgress, eq(studyProgress.personId, people.id))
    .where(eq(people.hidden, false));
}

// Absolute state, not "cycle" — the client works out the next state, this
// just records it. "none" deletes the row (not studied is the absence of
// one, so its date goes with it), anything else upserts.
//
// Every real change stamps the box with today's date (status_date: the day it
// reached this state). Saving the state a box is already in changes nothing —
// not the date, not who or when — so a tap that lands twice, or a retry, can't
// move a date. The upsert's WHERE does that check in the same statement that
// writes, so two saves racing can't both think they changed it.
export async function saveStudyStatus(
  userId: string,
  track: StudyTrackId,
  personId: string,
  item: number,
  unit: number,
  status: StudyStatus,
) {
  if (status === "none") {
    await db
      .delete(studyProgress)
      .where(and(eq(studyProgress.personId, personId), eq(studyProgress.track, track), eq(studyProgress.item, item), eq(studyProgress.unit, unit)));
    return;
  }
  const today = communityToday();
  await db
    .insert(studyProgress)
    .values({ personId, track, item, unit, status, statusDate: today, updatedByUserId: userId })
    .onConflictDoUpdate({
      target: [studyProgress.personId, studyProgress.track, studyProgress.item, studyProgress.unit],
      set: { status, statusDate: today, updatedByUserId: userId, updatedAt: new Date() },
      setWhere: sql`${studyProgress.status} is distinct from excluded.status`,
    });
}

// Whether the person has a log in any track — used to keep Delete from
// silently wiping it.
export async function hasStudyProgress(personId: string): Promise<boolean> {
  const [row] = await db.select({ id: studyProgress.id }).from(studyProgress).where(eq(studyProgress.personId, personId)).limit(1);
  return Boolean(row);
}

// Folds one person's study logs (every track) onto another's for a person
// merge. Per box, whichever of the two has got further wins (complete beats
// partial beats nothing), then the source's rows are dropped. Not in a
// transaction (the neon-http driver has none), but every step is safe to
// re-run, same as the rest of the merge code.
export async function mergeStudyProgress(fromPersonId: string, toPersonId: string) {
  // The survivor only has a box partly, the other person has it done — so it
  // takes the other's completion date (today, if that one has none).
  await db.execute(sql`
    UPDATE ruhi_unit_progress AS t
    SET status = 'complete',
        status_date = COALESCE(f.status_date, ${communityToday()}::date),
        updated_at = now()
    FROM ruhi_unit_progress AS f
    WHERE t.person_id = ${toPersonId}
      AND f.person_id = ${fromPersonId}
      AND t.track = f.track
      AND t.book = f.book
      AND t.unit = f.unit
      AND t.status = 'partial'
      AND f.status = 'complete'
  `);

  // Boxes the survivor has no row for at all move across as they are.
  const target = alias(studyProgress, "study_target");
  await db
    .update(studyProgress)
    .set({ personId: toPersonId })
    .where(
      and(
        eq(studyProgress.personId, fromPersonId),
        notExists(
          db
            .select()
            .from(target)
            .where(
              and(
                eq(target.personId, toPersonId),
                eq(target.track, studyProgress.track),
                eq(target.item, studyProgress.item),
                eq(target.unit, studyProgress.unit),
              ),
            ),
        ),
      ),
    );

  // Whatever's left is a box the survivor already has at least as far along.
  await db.delete(studyProgress).where(eq(studyProgress.personId, fromPersonId));
}
