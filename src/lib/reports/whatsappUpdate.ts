// Server-only reads for the admin WhatsApp Update report: everyone who has
// attended one of the last 4 lessons held by each chosen PSEC or JYSEP group, as
// one row per household contact with their participants alongside, ready to become
// a CSV. A plain module (not a "use server" file) so it can be tested without a login.
import { and, desc, eq, exists, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { activityInstances } from "@/db/schema/activityInstances";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
// Today in the community's own time zone (Brisbane), not the server's UTC —
// the helper's name comes from the study logs, which needed it first.
import { communityToday } from "@/lib/studyDate";

// How many of each group's most recent held lessons count as "recent".
const LESSON_COUNT = 4;

// The kinds of group the report's popup offers (Children's Class and Junior
// Youth Group), whatever ids a download asks for.
const GROUP_CATEGORIES = ["psec", "jysep"];

// Who a row belongs to when nobody is on file as the household's contact.
export const NO_CONTACT = "No contact on file";

// One person who attended, and whoever their household has down as its contact.
export type WhatsappPerson = {
  personId: string;
  name: string;
  preferredName: string | null;
  householdId: string | null;
  contactId: string | null;
  contactName: string | null;
  contactPreferredName: string | null;
  contactMobile: string | null;
};

export type WhatsappRow = {
  // null: nobody is on file as this household's contact.
  contactName: string | null;
  // "" when there is none; see cleanMobile for how it is written.
  contactMobile: string;
  participants: string[];
};

// A person as the rosters show them: the AKA when there is one, otherwise the
// full name.
function shownName(name: string, preferredName: string | null): string {
  return preferredName?.trim() || name.trim();
}

// Marks that can't be seen but come along when a number is copied out of another
// app, and stop WhatsApp recognising it: the soft hyphen, the Arabic letter
// mark, zero-width spaces and direction marks (U+200B to U+200F, U+202A to
// U+202E), the word joiner and invisible operators (U+2060 to U+2064), the
// isolates and their neighbours (U+2066 to U+206F) and the byte-order mark.
// Written as numbers so that they can be seen here.
function isHiddenMark(code: number): boolean {
  return (
    code === 0xad ||
    code === 0x61c ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) ||
    (code >= 0x2066 && code <= 0x206f) ||
    code === 0xfeff
  );
}

function withoutHiddenMarks(text: string): string {
  return Array.from(text)
    .filter((ch) => !isHiddenMark(ch.charCodeAt(0)))
    .join("");
}

// A contact's mobile as the CSV shows it. A number that is plainly an Australian
// mobile (0412 345 678, 0412345678, 412 345 678, +61 412 345 678, ...) is
// written in international form with spaces, +61 412 345 678: WhatsApp needs the
// country code to recognise it, and the spaces keep a spreadsheet from turning
// it into a plain number and dropping a leading 0. Anything else (a landline, an
// overseas number, a note, a "?") is left exactly as typed, minus the hidden
// marks, so it can be corrected in Edit All People rather than guessed at.
export function cleanMobile(raw: string | null): string {
  if (!raw) return "";
  const text = withoutHiddenMarks(raw).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (!/^[+\d\s().-]+$/.test(text)) return text;
  const digits = text.replace(/\D/g, "");
  const national = /^0(4\d{8})$/.exec(digits)?.[1] ?? /^(4\d{8})$/.exec(digits)?.[1] ?? /^(?:61|0061)0?(4\d{8})$/.exec(digits)?.[1];
  if (!national) return text;
  return `+61 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

const byName = (a: string, b: string) => a.localeCompare(b, "en-AU", { sensitivity: "base" });

type Group = { contactName: string | null; contactMobile: string; participants: Map<string, string> };

// Puts the people who attended under their household's contact. Brothers and
// sisters share a row; a person on several activities is listed once. People with
// no contact are not dropped: a household with none set keeps its members
// together, a person with no household at all gets a row of their own, and all
// of them follow the contacts (A to Z) so the gaps are easy to see.
export function buildRows(attended: WhatsappPerson[]): WhatsappRow[] {
  const groups = new Map<string, Group>();
  for (const p of attended) {
    const key = p.contactId ? `contact:${p.contactId}` : p.householdId ? `household:${p.householdId}` : `person:${p.personId}`;
    let group = groups.get(key);
    if (!group) {
      group = p.contactId
        ? { contactName: shownName(p.contactName ?? "", p.contactPreferredName), contactMobile: cleanMobile(p.contactMobile), participants: new Map() }
        : { contactName: null, contactMobile: "", participants: new Map() };
      groups.set(key, group);
    }
    group.participants.set(p.personId, shownName(p.name, p.preferredName));
  }

  const all = [...groups.values()].map(
    (g): WhatsappRow => ({ contactName: g.contactName, contactMobile: g.contactMobile, participants: [...g.participants.values()].sort(byName) }),
  );
  const withContact = all.filter((r) => r.contactName !== null).sort((a, b) => byName(a.contactName!, b.contactName!));
  const withoutContact = all.filter((r) => r.contactName === null).sort((a, b) => byName(a.participants[0] ?? "", b.participants[0] ?? ""));
  return [...withContact, ...withoutContact];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The group ids a download asks for ("id,id,id" in the link): each a real id,
// none repeated. null when there are none or any isn't an id, so a hand-edited
// link gets a plain "pick a group" answer rather than a database error.
export function parseActivityIds(raw: string | null): string[] | null {
  const ids = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0 || !ids.every((id) => UUID.test(id))) return null;
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

// A session of a group.
type Lesson = { id: string; activityInstanceId: string };

// From sessions already sorted newest first, the ids of each group's latest few.
export function latestLessonIds(lessons: Lesson[], perGroup: number): string[] {
  const counts = new Map<string, number>();
  const ids: string[] = [];
  for (const lesson of lessons) {
    const n = counts.get(lesson.activityInstanceId) ?? 0;
    if (n >= perGroup) continue;
    counts.set(lesson.activityInstanceId, n + 1);
    ids.push(lesson.id);
  }
  return ids;
}

// The lessons that count: each chosen group's last 4 that were actually held, that
// is sessions on or before today that were not cancelled and where someone was
// marked present. A date that was only added to the calendar, or that nobody came
// to, isn't a lesson, so a break between terms doesn't empty the report: a class
// that last met five weeks ago still has its last 4 lessons.
async function recentLessonIds(activityIds: string[]): Promise<string[]> {
  const lessons = await db
    .select({ id: attendanceEvents.id, activityInstanceId: attendanceEvents.activityInstanceId })
    .from(attendanceEvents)
    .innerJoin(activityInstances, eq(activityInstances.id, attendanceEvents.activityInstanceId))
    .where(
      and(
        inArray(attendanceEvents.activityInstanceId, activityIds),
        inArray(activityInstances.categoryId, GROUP_CATEGORIES),
        eq(activityInstances.hidden, false),
        eq(attendanceEvents.cancelled, false),
        lte(attendanceEvents.sessionDate, communityToday()),
        exists(
          db
            .select({ one: sql`1` })
            .from(attendanceRecords)
            .where(and(eq(attendanceRecords.attendanceEventId, attendanceEvents.id), eq(attendanceRecords.status, "present"))),
        ),
      ),
    )
    .orderBy(desc(attendanceEvents.sessionDate));
  return latestLessonIds(lessons, LESSON_COUNT);
}

// Participants (a roster entry as a participant, not a facilitator or assistant,
// still active) of the chosen groups who were marked present at one of that group's
// last 4 held lessons: "actually attended, not just enrolled", as in the Family
// Visit Planner and Missing Data reports, but counted in lessons rather than days.
// Only PSEC and JYSEP groups can be chosen, and hidden people and groups don't
// count. A separate EXISTS rather than a join, so someone who came to several
// lessons doesn't fan out into duplicate rows.
export async function getWhatsappRows(activityIds: string[]): Promise<WhatsappRow[]> {
  const lessonIds = await recentLessonIds(activityIds);
  if (lessonIds.length === 0) return [];
  const householdContacts = alias(people, "household_contacts");

  const attended = await db
    .select({
      personId: people.id,
      name: people.name,
      preferredName: people.preferredName,
      householdId: people.householdId,
      contactId: households.contactPersonId,
      contactName: householdContacts.name,
      contactPreferredName: householdContacts.preferredName,
      contactMobile: householdContacts.mobile,
    })
    .from(activityEnrollments)
    .innerJoin(people, eq(people.id, activityEnrollments.personId))
    .innerJoin(activityInstances, eq(activityInstances.id, activityEnrollments.activityInstanceId))
    .leftJoin(households, eq(households.id, people.householdId))
    .leftJoin(householdContacts, eq(householdContacts.id, households.contactPersonId))
    .where(
      and(
        inArray(activityInstances.id, activityIds),
        inArray(activityInstances.categoryId, GROUP_CATEGORIES),
        eq(activityEnrollments.role, "participant"),
        eq(activityEnrollments.active, true),
        eq(activityInstances.hidden, false),
        eq(people.hidden, false),
        exists(
          db
            .select({ one: sql`1` })
            .from(attendanceRecords)
            .innerJoin(attendanceEvents, eq(attendanceEvents.id, attendanceRecords.attendanceEventId))
            .where(
              and(
                eq(attendanceRecords.personId, people.id),
                eq(attendanceEvents.activityInstanceId, activityInstances.id),
                eq(attendanceRecords.status, "present"),
                inArray(attendanceEvents.id, lessonIds),
              ),
            ),
        ),
      ),
    );

  return buildRows(attended);
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// One line per row: Contact Name, Contact Mobile, then a column for each of
// their participants, as many as the biggest family needs.
export function toCsv(rows: WhatsappRow[]): string {
  const width = Math.max(1, ...rows.map((r) => r.participants.length));
  const header = ["Contact Name", "Contact Mobile", ...Array.from({ length: width }, (_, i) => `Participant ${i + 1}`)];
  const lines = [header];
  for (const r of rows) {
    const padding = Array.from({ length: width - r.participants.length }, () => "");
    lines.push([r.contactName ?? NO_CONTACT, r.contactMobile, ...r.participants, ...padding]);
  }
  return lines.map((cols) => cols.map(csvField).join(",")).join("\n");
}

export async function generateWhatsappUpdateCsv(activityIds: string[]): Promise<string> {
  return toCsv(await getWhatsappRows(activityIds));
}
