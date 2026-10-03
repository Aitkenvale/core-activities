"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { assertValidStudyCell, isStudyStatus, studyTrackFor, type StudyStatus } from "@/lib/studyTracks";
import { listStudyProgress, saveStudyStatus, type StudyProgressEntry } from "@/lib/studyProgress";

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
export async function getStudyProgress(trackId: string, personIds: string[]): Promise<StudyProgressEntry[]> {
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
