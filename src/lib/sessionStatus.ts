// Server-only: confirming a session and cancelling it. They are alternatives,
// not independent switches — a class that didn't happen has no attendance to
// confirm, and a confirmed roll can't also have been cancelled — so each one
// refuses while the other is on. Kept out of the "use server" action files so
// it can be tested without a login session.
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendanceEvents } from "@/db/schema/attendanceEvents";

// Confirms (locked) or un-confirms a session. Confirming is refused, and false
// returned, if the class is cancelled; un-confirming is always allowed.
// One statement, so a cancel landing at the same moment can't slip between the
// check and the write.
export async function setEventLocked(eventId: string, locked: boolean): Promise<boolean> {
  const rows = await db
    .update(attendanceEvents)
    .set({ locked })
    .where(and(eq(attendanceEvents.id, eventId), locked ? eq(attendanceEvents.cancelled, false) : undefined))
    .returning({ id: attendanceEvents.id });
  return rows.length > 0;
}

// Cancels or reinstates a session. Cancelling is refused, and false returned,
// if attendance is confirmed; reinstating is always allowed.
export async function setEventCancelled(eventId: string, cancelled: boolean): Promise<boolean> {
  const rows = await db
    .update(attendanceEvents)
    .set({ cancelled })
    .where(and(eq(attendanceEvents.id, eventId), cancelled ? eq(attendanceEvents.locked, false) : undefined))
    .returning({ id: attendanceEvents.id });
  return rows.length > 0;
}
