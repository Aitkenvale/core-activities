// Server-only reads for the admin WhatsApp Update report: everyone who has
// attended in the last 4 weeks, as one row per household contact with their
// participants alongside, ready to become a CSV. A plain module (not a
// "use server" file) so it can be tested without a login.
import { and, eq, exists, gte, lte, sql } from "drizzle-orm";
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

// "The last 4 weeks": a session held on or after this many days before today.
const WINDOW_DAYS = 28;

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

export type WhatsappSummary = {
  // Contacts first (A to Z), then the people with no contact on file.
  rows: WhatsappRow[];
  participantCount: number;
  contactCount: number;
  // Participants with no contact on file (no household, or a household with none set).
  withoutContactCount: number;
  contactsWithoutMobileCount: number;
};

export type WhatsappUpdate = WhatsappSummary & {
  // The first day counted, and today (YYYY-MM-DD).
  from: string;
  to: string;
};

function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// A person as the rosters show them: the AKA when there is one, otherwise the
// full name.
function shownName(name: string, preferredName: string | null): string {
  return preferredName?.trim() || name.trim();
}

// Marks that can't be seen but come along when a number is copied out of another
// app (left-to-right marks, zero-width spaces and the like). They stop WhatsApp
// recognising the number, so they go from everything.
const INVISIBLE = /[­؜​-‏‪-‮⁠-⁤⁦-⁯﻿]/g;

// A contact's mobile as the CSV shows it. A number that is plainly an Australian
// mobile (0412 345 678, 0412345678, 412 345 678, +61 412 345 678, ...) is
// written in international form with spaces, +61 412 345 678: WhatsApp needs the
// country code to recognise it, and the spaces keep a spreadsheet from turning
// it into a plain number and dropping a leading 0. Anything else (a landline, an
// overseas number, a note, a "?") is left exactly as typed, minus the hidden
// marks, so it can be corrected in Edit All People rather than guessed at.
export function cleanMobile(raw: string | null): string {
  if (!raw) return "";
  const text = raw.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
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
// of them follow the contacts so the gaps are easy to see.
export function buildRows(attended: WhatsappPerson[]): WhatsappSummary {
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

  const toRow = (g: Group): WhatsappRow => ({
    contactName: g.contactName,
    contactMobile: g.contactMobile,
    participants: [...g.participants.values()].sort(byName),
  });
  const all = [...groups.values()].map(toRow);
  const withContact = all.filter((r) => r.contactName !== null).sort((a, b) => byName(a.contactName!, b.contactName!));
  const withoutContact = all.filter((r) => r.contactName === null).sort((a, b) => byName(a.participants[0] ?? "", b.participants[0] ?? ""));

  return {
    rows: [...withContact, ...withoutContact],
    participantCount: all.reduce((n, r) => n + r.participants.length, 0),
    contactCount: withContact.length,
    withoutContactCount: withoutContact.reduce((n, r) => n + r.participants.length, 0),
    contactsWithoutMobileCount: withContact.filter((r) => !r.contactMobile).length,
  };
}

// Participants (a roster entry as a participant, not a facilitator or
// assistant, still active) marked present at that activity within the last 4
// weeks: the same "actually attended, not just enrolled" rule as the Family Visit
// Planner and Missing Data reports, with the cut-off taken from the Brisbane date
// rather than the server's UTC one. Every kind of activity counts; hidden people
// and hidden activities don't. A separate EXISTS rather than a join, so someone
// who came several times doesn't fan out into duplicate rows.
export async function getWhatsappUpdate(): Promise<WhatsappUpdate> {
  const today = communityToday();
  const from = daysBefore(today, WINDOW_DAYS);
  const householdContacts = alias(people, "household_contacts");

  const rows = await db
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
                gte(attendanceEvents.sessionDate, from),
                lte(attendanceEvents.sessionDate, today),
              ),
            ),
        ),
      ),
    );

  return { from, to: today, ...buildRows(rows) };
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

export async function generateWhatsappUpdateCsv(): Promise<string> {
  const { rows } = await getWhatsappUpdate();
  return toCsv(rows);
}
