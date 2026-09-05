import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, exists, gte, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { activityInstances } from "@/db/schema/activityInstances";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";

export type FamilyReportCategory = "psec" | "jysep";

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

// Every participant in the given category, grouped by household — but only
// those who've actually attended (a real "present" mark) that specific
// class within the last 3 months, not just anyone still enrolled. A
// household with no address on file still gets its own group (filed under
// "No Address"), and a participant with no household at all becomes their
// own singleton group rather than being silently dropped or merged with
// unrelated no-household children.
async function getFamilyGroups(categoryId: FamilyReportCategory): Promise<FamilyGroup[]> {
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
        eq(activityInstances.categoryId, categoryId),
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

function csvField(value: string | null): string {
  const s = value ?? "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function generateFamilyReportCsv(categoryId: FamilyReportCategory): Promise<string> {
  const groups = await getFamilyGroups(categoryId);
  const header = ["Suburb", "Household", "Address", "Contact", "Mobile", "Participant", "Class"];
  const lines = [header.join(",")];
  for (const g of groups) {
    for (const p of g.participants) {
      lines.push(
        [g.suburb, g.householdName, g.address ?? "", g.contactName ?? "", g.contactMobile ?? "", p.participantName, p.className]
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

// Column widths (portrait A4, 539pt usable) — sized so 6 columns of real
// content fit at a small-but-legible size without wrapping onto a second
// line per cell, which is what actually keeps this to a handful of pages.
const COL = { household: 90, address: 128, contact: 82, mobile: 68, participant: 92, className: 79 };

function ColumnHeader() {
  return (
    <View style={styles.row} fixed>
      <Text style={{ ...styles.headerCell, width: COL.household }}>Household</Text>
      <Text style={{ ...styles.headerCell, width: COL.address }}>Address</Text>
      <Text style={{ ...styles.headerCell, width: COL.contact }}>Contact</Text>
      <Text style={{ ...styles.headerCell, width: COL.mobile }}>Mobile</Text>
      <Text style={{ ...styles.headerCell, width: COL.participant }}>Participant</Text>
      <Text style={{ ...styles.headerCell, width: COL.className }}>Class</Text>
    </View>
  );
}

export async function generateFamilyReportPdf(categoryId: FamilyReportCategory): Promise<Buffer> {
  const groups = await getFamilyGroups(categoryId);

  // Suburb is a section break, not a repeated column — saves a whole
  // column's width, and reads more clearly than the same suburb name
  // repeated down dozens of rows.
  const bySuburb = new Map<string, FamilyGroup[]>();
  for (const g of groups) {
    if (!bySuburb.has(g.suburb)) bySuburb.set(g.suburb, []);
    bySuburb.get(g.suburb)!.push(g);
  }

  const label = categoryId.toUpperCase();

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{label} Family Report</Text>
        <Text style={styles.subtitle}>
          Every household with a {label} participant who&rsquo;s attended in the last 3 months, grouped by suburb.
        </Text>
        <ColumnHeader />
        <View style={styles.table}>
          {Array.from(bySuburb.entries()).map(([suburb, householdsInSuburb]) => (
            <View key={suburb}>
              <Text style={styles.suburbHeader}>{suburb}</Text>
              {householdsInSuburb.map((g) =>
                g.participants.map((p, i) => (
                  <View key={`${g.key}-${i}`} style={styles.row} wrap={false}>
                    <Text style={{ ...styles.cell, width: COL.household }}>{i === 0 ? g.householdName : ""}</Text>
                    <Text style={{ ...styles.cell, width: COL.address }}>{i === 0 ? (g.address ?? "—") : ""}</Text>
                    <Text style={{ ...styles.cell, width: COL.contact }}>{i === 0 ? (g.contactName ?? "—") : ""}</Text>
                    <Text style={{ ...styles.cell, width: COL.mobile }}>{i === 0 ? (g.contactMobile ?? "—") : ""}</Text>
                    <Text style={{ ...styles.cell, width: COL.participant }}>{p.participantName}</Text>
                    <Text style={{ ...styles.cell, width: COL.className }}>{p.className}</Text>
                  </View>
                )),
              )}
            </View>
          ))}
        </View>
      </Page>
    </Document>,
  );
}
