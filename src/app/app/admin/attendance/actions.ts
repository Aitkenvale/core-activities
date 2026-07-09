"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { attendanceEvents } from "@/db/schema/attendanceEvents";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") throw new Error("Admin only");
  return session;
}

// Backdating a whole activity's history (or one that was never tracked in
// the app at all) needs a way to create session dates directly, not just
// toggle attendance on dates that already happen to have an event row.
export async function addAttendanceDate(activityInstanceId: string, sessionDate: string) {
  const session = await requireAdmin();
  const existing = await db.query.attendanceEvents.findFirst({
    where: and(eq(attendanceEvents.activityInstanceId, activityInstanceId), eq(attendanceEvents.sessionDate, sessionDate)),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(attendanceEvents)
    .values({ activityInstanceId, sessionDate, wasGeneratedFromCadence: false, createdByUserId: session.user.id })
    .returning();
  return created;
}
