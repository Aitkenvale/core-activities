"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { assertValidStudyCell, isStudyStatus, studyCellKey, studyTrackFor, type StudyRestoreBox, type StudyStatus } from "@/lib/studyTracks";
import {
  listStudyProgress,
  restoreStudyBoxes,
  saveStudyStatus,
  type StudyProgressWithDate,
  type StudyRestoreRow,
} from "@/lib/studyProgress";
import { communityToday } from "@/lib/studyDate";

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in");
  return session.user.id;
}

function trackOrThrow(trackId: string) {
  const track = studyTrackFor(trackId);
  if (!track) throw new Error("Invalid study log.");
  return track;
}

// Open to any signed-in user, same as taking attendance itself — and
// deliberately not subject to a session's Confirmed/Cancelled state or the
// edit window: the log belongs to the person, not to any one session date.
export async function getStudyProgress(trackId: string, personIds: string[]): Promise<StudyProgressWithDate[]> {
  await requireUserId();
  return listStudyProgress(trackOrThrow(trackId).id, personIds);
}

export async function setStudyStatus(trackId: string, personId: string, item: number, unit: number, status: StudyStatus) {
  const userId = await requireUserId();
  const track = trackOrThrow(trackId);
  assertValidStudyCell(track, item, unit);
  if (!isStudyStatus(status)) throw new Error("Invalid status.");
  await saveStudyStatus(userId, track.id, personId, item, unit, status);
}

// The most boxes one Cancel can put back — a stop on a runaway request, far
// more than any screen holds.
const MAX_RESTORE = 2000;

// Cancel on the study screen: puts boxes back exactly as they were when it
// was opened, hidden date included. Everything is checked first and the
// writing is a single statement, so it either all happens or none of it does,
// and trying again after a failure is always safe.
export async function restoreStudyStatuses(boxes: StudyRestoreBox[]) {
  const userId = await requireUserId();
  if (!Array.isArray(boxes) || boxes.length > MAX_RESTORE) throw new Error("Too many boxes to put back.");
  const today = communityToday();
  // One entry per box — the last one given if a box is repeated.
  const checked = new Map<string, StudyRestoreRow>();
  for (const box of boxes) {
    const track = trackOrThrow(box.trackId);
    assertValidStudyCell(track, box.item, box.unit);
    if (!isStudyStatus(box.status)) throw new Error("Invalid status.");
    if (typeof box.personId !== "string") throw new Error("Invalid person.");
    // A date can only be one a box really had: a real day, not in the future.
    const date = box.statusDate;
    if (date !== null && !(typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= "2000-01-01" && date <= today)) {
      throw new Error("Invalid date.");
    }
    checked.set(`${track.id}|${studyCellKey(box.personId, box.item, box.unit)}`, {
      track: track.id,
      personId: box.personId,
      item: box.item,
      unit: box.unit,
      status: box.status,
      statusDate: date,
    });
  }
  await restoreStudyBoxes(userId, [...checked.values()]);
}
