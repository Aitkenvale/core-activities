import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, exists, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { activityInstances } from "@/db/schema/activityInstances";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { fitColumns, fitText, textWidth } from "@/lib/reports/pdfText";

// The kinds of class the report can cover (Children's Class and Junior Youth
// Group), whatever ids a download asks for.
const REPORT_CATEGORIES = ["psec", "jysep"];

type ParticipantRow = { participantName: string; className: string };

type FamilyGroup = {
  key: string;
  householdName: string;
  address: string | null;
  contactName: string | null;
  contactMobile: string | null;
  suburb: string;
  participants: ParticipantRow[];
};

export type FamilyReport = {
  // Which kinds of class were chosen: "PSEC", "JYSEP" or "PSEC and JYSEP".
  label: string;
  // How many classes were chosen.
  classCount: number;
  groups: FamilyGroup[];
};

// Addresses are one free-text field ("88 Anne St, Aitkenvale", or
// sometimes just "Kirwan" with no street) — there's no dedicated suburb
// column, so this takes whatever's after the last comma as the suburb,
// or the whole string when there's no comma at all (covers the
// suburb-only entries). Not a real geocoder — a handful of street-only
// addresses with no suburb will show up oddly grouped, but that's visible
// in the report itself (the address is right there), not silently wrong.
function deriveSuburb(address: string | null): string {
  if (!address?.trim()) return "No Address";
  const parts = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const last = parts.length > 0 ? parts[parts.length - 1] : null;
  if (!last) return "No Address";
  // A trailing parenthetical note ("Kirwan (gate 2601#)") isn't part of
  // the suburb name — stripping it keeps that address grouped with every
  // other plain "Kirwan" entry instead of splitting off its own section.
  const stripped = last.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return stripped || last;
}

function threeMonthsAgoIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

// Every participant in the chosen classes, grouped by household — but only
// those who've actually attended (a real "present" mark) that specific
// class within the last 3 months, not just anyone still enrolled. A
// household with no address on file still gets its own group (filed under
// "No Address"), and a participant with no household at all becomes their
// own singleton group rather than being silently dropped or merged with
// unrelated no-household children. A household with a child in each kind of
// class is one group, with both children listed.
async function getFamilyGroups(activityIds: string[]): Promise<FamilyGroup[]> {
  const householdContacts = alias(people, "household_contacts");
  const cutoff = threeMonthsAgoIso();

  const rows = await db
    .select({
      householdId: households.id,
      householdName: households.name,
      address: households.address,
      contactName: householdContacts.name,
      contactMobile: householdContacts.mobile,
      participantId: people.id,
      participantName: people.name,
      className: activityInstances.name,
    })
    .from(activityEnrollments)
    .innerJoin(people, eq(people.id, activityEnrollments.personId))
    .innerJoin(activityInstances, eq(activityInstances.id, activityEnrollments.activityInstanceId))
    .leftJoin(households, eq(households.id, people.householdId))
    .leftJoin(householdContacts, eq(householdContacts.id, households.contactPersonId))
    .where(
      and(
        inArray(activityInstances.id, activityIds),
        inArray(activityInstances.categoryId, REPORT_CATEGORIES),
        eq(activityEnrollments.role, "participant"),
        eq(activityEnrollments.active, true),
        eq(people.hidden, false),
        // A left join, not inner — a participant with no household at all
        // should still show up (as their own singleton group), so this
        // can't just be eq(households.hidden, false): that would silently
        // drop every no-household row too, since a plain equality check
        // against a null column never matches.
        or(isNull(households.id), eq(households.hidden, false)),
        // Actually attended this specific class recently — not just still
        // enrolled. A separate EXISTS rather than a join, so a person who
        // attended several times in the window doesn't fan out into
        // duplicate rows.
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
                gte(attendanceEvents.sessionDate, cutoff),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(people.name));

  const groups = new Map<string, FamilyGroup>();
  for (const r of rows) {
    const key = r.householdId ?? `person:${r.participantId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        householdName: r.householdName ?? r.participantName,
        address: r.address,
        contactName: r.householdId ? r.contactName : null,
        contactMobile: r.householdId ? r.contactMobile : null,
        suburb: deriveSuburb(r.address),
        participants: [],
      });
    }
    groups.get(key)!.participants.push({ participantName: r.participantName, className: r.className });
  }

  return Array.from(groups.values()).sort(
    (a, b) => a.suburb.localeCompare(b.suburb) || a.householdName.localeCompare(b.householdName),
  );
}

// The report for the classes with these ids: what kinds of class they are (for the
// title and the file name), how many, and the households. Ids that aren't a PSEC
// or JYSEP class are ignored; none left is an error.
export async function getFamilyReport(activityIds: string[]): Promise<FamilyReport> {
  const classes = await db
    .select({ categoryId: activityInstances.categoryId })
    .from(activityInstances)
    .where(and(inArray(activityInstances.id, activityIds), inArray(activityInstances.categoryId, REPORT_CATEGORIES)));
  if (classes.length === 0) throw new Error("Select at least one class.");
  const kinds = REPORT_CATEGORIES.filter((c) => classes.some((k) => k.categoryId === c));
  return { label: kinds.map((k) => k.toUpperCase()).join(" and "), classCount: classes.length, groups: await getFamilyGroups(activityIds) };
}

function csvField(value: string | null): string {
  const s = value ?? "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function familyReportCsv(report: FamilyReport): string {
  const header = ["Suburb", "Participant", "Class", "Household", "Contact", "Mobile", "Address"];
  const lines = [header.join(",")];
  for (const g of report.groups) {
    for (const p of g.participants) {
      lines.push(
        [g.suburb, p.participantName, p.className, g.householdName, g.contactName ?? "", g.contactMobile ?? "", g.address ?? ""]
          .map(csvField)
          .join(","),
      );
    }
  }
  return lines.join("\n");
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 7.5, fontFamily: "Helvetica" },
  title: { fontSize: 13, marginBottom: 2 },
  subtitle: { fontSize: 8, color: "#6B4C2A", marginBottom: 10 },
  suburbHeader: { fontSize: 8.5, fontWeight: 700, backgroundColor: "#F3EDE1", padding: "3pt 4pt", marginTop: 8, marginBottom: 2 },
  table: { borderTop: "1pt solid #D9C9A8", borderLeft: "1pt solid #D9C9A8" },
  row: { flexDirection: "row" },
  headerCell: { padding: "3pt 4pt", borderRight: "1pt solid #D9C9A8", borderBottom: "1pt solid #D9C9A8", fontSize: 7, backgroundColor: "#EFEFEF" },
  cell: { padding: "2pt 4pt", borderRight: "1pt solid #D9C9A8", borderBottom: "1pt solid #D9C9A8" },
});

// --- Fitting the table to the page -------------------------------------------------
// Every person is one line: nothing in the table is ever allowed to wrap. Each
// column is given the width its longest cell needs, so far as the page allows;
// when the page can't take all of them, the widest columns share the squeeze
// (see fitColumns) and only their longest cells are cut short, to an ellipsis, by
// fitText. Short columns such as the mobile number are never touched.
const A4_WIDTH = 595.28;
const PAGE_PADDING = 28;
const CELL_FONT = 7.5;
const HEADER_FONT = 7;
// A cell's padding (4 each side) and its right border (1).
const CELL_PADDING = 9;
// The table's left border is 1, and a little breathing room keeps rounding from
// pushing the last column off the page.
const TABLE_WIDTH = A4_WIDTH - 2 * PAGE_PADDING - 1 - 0.5;
// No column is squeezed below this, or below its heading.
const MIN_COLUMN = 36;

type ColumnKey = "participant" | "className" | "household" | "contact" | "mobile" | "address";
// keep: how much a column is worth protecting when the page can't fit them all (see
// fitColumns). The class name is what tells the classes apart, so it holds on to its
// text longest; the household name mostly repeats the surname, and an address ends
// with the suburb, which is already the heading above it, so those are cut first.
const COLUMNS: { key: ColumnKey; header: string; keep: number }[] = [
  { key: "participant", header: "Participant", keep: 1 },
  { key: "className", header: "Class", keep: 1.3 },
  { key: "household", header: "Household", keep: 0.7 },
  { key: "contact", header: "Contact", keep: 1 },
  { key: "mobile", header: "Mobile", keep: 1 },
  { key: "address", header: "Address", keep: 0.9 },
];

type TableRow = Record<ColumnKey, string>;
type Section = { suburb: string; rows: TableRow[] };

// One table row per person. The household's own details (household, contact,
// mobile, address) are on the first row of its people only.
export function toSections(groups: FamilyGroup[]): Section[] {
  // Suburb is a section break, not a repeated column — saves a whole
  // column's width, and reads more clearly than the same suburb name
  // repeated down dozens of rows.
  const bySuburb = new Map<string, Section>();
  for (const g of groups) {
    if (!bySuburb.has(g.suburb)) bySuburb.set(g.suburb, { suburb: g.suburb, rows: [] });
    g.participants.forEach((p, i) => {
      bySuburb.get(g.suburb)!.rows.push({
        participant: p.participantName,
        className: p.className,
        household: i === 0 ? g.householdName : "",
        contact: i === 0 ? (g.contactName ?? "—") : "",
        mobile: i === 0 ? (g.contactMobile ?? "—") : "",
        address: i === 0 ? (g.address ?? "—") : "",
      });
    });
  }
  return Array.from(bySuburb.values());
}

export function columnWidths(sections: Section[]): number[] {
  const rows = sections.flatMap((s) => s.rows);
  const heading = COLUMNS.map((c) => textWidth(c.header, HEADER_FONT) + CELL_PADDING);
  const needs = COLUMNS.map((c, i) => Math.max(heading[i], ...rows.map((r) => textWidth(r[c.key], CELL_FONT) + CELL_PADDING)));
  const floors = heading.map((h) => Math.max(h, MIN_COLUMN));
  return fitColumns(needs, floors, TABLE_WIDTH, COLUMNS.map((c) => c.keep));
}

// A row of the table: a person on one line. maxLines is only the last safety net
// (the text has already been cut to fit); it can't be the main way, because
// react-pdf cuts at a word and then adds its ellipsis after the line is full.
const oneLine = { maxLines: 1, textOverflow: "ellipsis" } as const;

export async function familyReportPdf(report: FamilyReport): Promise<Buffer> {
  const sections = toSections(report.groups);
  const widths = columnWidths(sections);
  const classes = report.classCount === 1 ? "the selected class" : `one of the ${report.classCount} selected classes`;

  const personRow = (row: TableRow, key: number) => (
    <View key={key} style={styles.row} wrap={false}>
      {COLUMNS.map((c, i) => (
        <Text key={c.key} style={{ ...styles.cell, width: widths[i], ...oneLine }}>
          {fitText(row[c.key], widths[i] - CELL_PADDING, CELL_FONT)}
        </Text>
      ))}
    </View>
  );

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.label} Family Visit Planner</Text>
        <Text style={styles.subtitle}>
          Every household with a participant who&rsquo;s attended {classes} in the last 3 months, grouped by suburb.
        </Text>
        <View style={styles.row} fixed>
          {COLUMNS.map((c, i) => (
            <Text key={c.key} style={{ ...styles.headerCell, width: widths[i], ...oneLine }}>
              {c.header}
            </Text>
          ))}
        </View>
        <View style={styles.table}>
          {sections.map((section) => (
            <View key={section.suburb}>
              {/* The heading and the first person are one unbreakable piece, so a
                  suburb's heading is never left alone at the foot of a page with its
                  rows on the next (react-pdf's minPresenceAhead can't do this: it only
                  acts on an element that has a sibling before it). */}
              <View wrap={false}>
                <Text style={styles.suburbHeader}>{section.suburb}</Text>
                {personRow(section.rows[0], 0)}
              </View>
              {section.rows.slice(1).map((row, ri) => personRow(row, ri + 1))}
            </View>
          ))}
        </View>
      </Page>
    </Document>,
  );
}
