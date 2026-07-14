import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { termDates } from "@/db/schema/termDates";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { people } from "@/db/schema/people";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";

// toLocaleDateString's "short" month can render the full month name on some
// runtimes — spelled out ourselves so "12 Jul" is guaranteed, matching the
// same format used for the date pills in the Attendance session UI.
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}
function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type TermOption = { year: number; termNumber: number; startDate: string; endDate: string };

// A term's own recorded end_date isn't actually the boundary we want —
// there's a real gap between it and the next term's start_date (school
// holidays), and any session in that gap needs to land in *some* term's
// report, not fall through the cracks. So a term's true reporting range
// runs from its own start_date up to (but not including) the *next* term's
// start_date — which means the exclusive end date isn't knowable until
// that next term has actually been entered. Terms are ordered by
// (year, termNumber), and "next" wraps into the following year — so the
// last term in the table (whatever year it is) has no known end yet, until
// next year's Term 1 is added, and can't be reported until then.
async function getTermsWithNextStart(): Promise<{ term: TermOption; rangeEnd: string }[]> {
  const terms = await db.select().from(termDates).orderBy(asc(termDates.year), asc(termDates.termNumber));
  const result: { term: TermOption; rangeEnd: string }[] = [];
  for (let i = 0; i < terms.length - 1; i++) {
    result.push({ term: terms[i], rangeEnd: terms[i + 1].startDate });
  }
  return result;
}

// Only terms whose end boundary is known (see above) AND have at least one
// real attendance_events row in range — an admin shouldn't be offered a
// term that can't be bounded yet, or one with nothing to report.
export async function getAvailableTerms(): Promise<TermOption[]> {
  const termsWithNextStart = await getTermsWithNextStart();
  const available: TermOption[] = [];
  for (const { term, rangeEnd } of termsWithNextStart) {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceEvents)
      .where(and(gte(attendanceEvents.sessionDate, term.startDate), lt(attendanceEvents.sessionDate, rangeEnd)));
    if (Number(row.count) > 0) available.push(term);
  }
  return available;
}

type RosterPerson = { personId: string; name: string };

type ActivityReport = {
  activityName: string;
  categoryLabel: string;
  eventDates: string[];
  participants: RosterPerson[];
  facilitators: RosterPerson[];
  // personId -> sessionDate -> "present" | "absent"
  statusByPerson: Map<string, Map<string, string>>;
};

async function buildActivityReport(
  activityId: string,
  activityName: string,
  categoryLabel: string,
  startDate: string,
  rangeEnd: string,
): Promise<ActivityReport | null> {
  const events = await db
    .select({ id: attendanceEvents.id, sessionDate: attendanceEvents.sessionDate })
    .from(attendanceEvents)
    .where(and(eq(attendanceEvents.activityInstanceId, activityId), gte(attendanceEvents.sessionDate, startDate), lt(attendanceEvents.sessionDate, rangeEnd)))
    .orderBy(asc(attendanceEvents.sessionDate));
  if (events.length === 0) return null;

  const eventIds = events.map((e) => e.id);
  const eventDateById = new Map(events.map((e) => [e.id, e.sessionDate]));

  const roster = await db
    .select({ personId: people.id, name: people.name, role: activityEnrollments.role })
    .from(activityEnrollments)
    .innerJoin(people, eq(people.id, activityEnrollments.personId))
    .where(eq(activityEnrollments.activityInstanceId, activityId));

  const records = await db
    .select({ personId: attendanceRecords.personId, attendanceEventId: attendanceRecords.attendanceEventId, status: attendanceRecords.status })
    .from(attendanceRecords)
    .where(inArray(attendanceRecords.attendanceEventId, eventIds));

  const statusByPerson = new Map<string, Map<string, string>>();
  for (const r of records) {
    const sessionDate = eventDateById.get(r.attendanceEventId);
    if (!sessionDate) continue;
    if (!statusByPerson.has(r.personId)) statusByPerson.set(r.personId, new Map());
    statusByPerson.get(r.personId)!.set(sessionDate, r.status);
  }

  // "Remove names if they did not attend for that quarter" — enrolled but
  // never actually marked present this term doesn't get a row.
  function attendedAtLeastOnce(personId: string): boolean {
    const byDate = statusByPerson.get(personId);
    if (!byDate) return false;
    return [...byDate.values()].some((s) => s === "present");
  }

  const byName = (a: RosterPerson, b: RosterPerson) => a.name.localeCompare(b.name);
  const participants = roster.filter((r) => r.role === "participant" && attendedAtLeastOnce(r.personId)).sort(byName);
  const facilitators = roster.filter((r) => r.role === "facilitator" && attendedAtLeastOnce(r.personId)).sort(byName);
  if (participants.length === 0 && facilitators.length === 0) return null;

  return { activityName, categoryLabel, eventDates: events.map((e) => e.sessionDate), participants, facilitators, statusByPerson };
}

export async function generateAttendanceReportPdf(year: number, termNumber: number): Promise<Buffer> {
  const termsWithNextStart = await getTermsWithNextStart();
  const match = termsWithNextStart.find(({ term }) => term.year === year && term.termNumber === termNumber);
  if (!match) throw new Error("That term isn't available — either it doesn't exist, or the next term's start date isn't set yet.");
  const { term, rangeEnd } = match;

  const [activities, categories] = await Promise.all([
    db.select().from(activityInstances).where(eq(activityInstances.hidden, false)).orderBy(asc(activityInstances.name)),
    db.select().from(activityCategories),
  ]);
  const categoryLabel = Object.fromEntries(categories.map((c) => [c.id, c.label]));

  const reports: ActivityReport[] = [];
  for (const activity of activities) {
    const report = await buildActivityReport(activity.id, activity.name, categoryLabel[activity.categoryId] ?? activity.categoryId, term.startDate, rangeEnd);
    if (report) reports.push(report);
  }

  return renderToBuffer(
    <Document>
      {reports.map((r) => (
        <ActivityPage key={r.activityName} term={term} rangeEnd={rangeEnd} report={r} />
      ))}
    </Document>,
  );
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: "Helvetica" },
  title: { fontSize: 13, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555555", marginBottom: 12 },
  sectionLabel: { fontSize: 9, marginTop: 10, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  table: { borderTop: "1pt solid #999999", borderLeft: "1pt solid #999999" },
  row: { flexDirection: "row" },
  headerCell: {
    flex: 1,
    minWidth: 0,
    padding: "3pt 2pt",
    borderRight: "1pt solid #999999",
    borderBottom: "1pt solid #999999",
    fontSize: 7,
    textAlign: "center",
    backgroundColor: "#EFEFEF",
  },
  nameHeaderCell: {
    width: 150,
    flexShrink: 0,
    padding: "3pt 4pt",
    borderRight: "1pt solid #999999",
    borderBottom: "1pt solid #999999",
    fontSize: 7,
    backgroundColor: "#EFEFEF",
  },
  nameCell: { width: 150, flexShrink: 0, padding: "2pt 4pt", borderRight: "1pt solid #999999", borderBottom: "1pt solid #999999" },
  dateCell: { flex: 1, minWidth: 0, padding: "2pt 2pt", borderRight: "1pt solid #999999", borderBottom: "1pt solid #999999", textAlign: "center" },
  noData: { fontSize: 8, color: "#777777", marginTop: 6 },
});

function AttendanceTable({ people: rows, eventDates, statusByPerson }: { people: RosterPerson[]; eventDates: string[]; statusByPerson: Map<string, Map<string, string>> }) {
  return (
    <View style={styles.table}>
      <View style={styles.row}>
        <Text style={styles.nameHeaderCell}>Name</Text>
        {eventDates.map((d) => (
          <Text key={d} style={styles.headerCell}>
            {formatShort(d)}
          </Text>
        ))}
      </View>
      {rows.map((p) => {
        const byDate = statusByPerson.get(p.personId);
        return (
          <View key={p.personId} style={styles.row} wrap={false}>
            <Text style={styles.nameCell}>{p.name}</Text>
            {eventDates.map((d) => (
              <Text key={d} style={styles.dateCell}>
                {/* "X" not "✓" — the checkmark glyph isn't in the built-in
                    Helvetica encoding react-pdf uses, so it silently
                    rendered as nothing. */}
                {byDate?.get(d) === "present" ? "X" : ""}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function ActivityPage({ term, rangeEnd, report }: { term: TermOption; rangeEnd: string; report: ActivityReport }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>{report.activityName}</Text>
      <Text style={styles.subtitle}>
        {report.categoryLabel} — {term.year} Term {term.termNumber} ({formatShort(term.startDate)}–{formatShort(dayBefore(rangeEnd))})
      </Text>

      <Text style={styles.sectionLabel}>Participants</Text>
      {report.participants.length > 0 ? (
        <AttendanceTable people={report.participants} eventDates={report.eventDates} statusByPerson={report.statusByPerson} />
      ) : (
        <Text style={styles.noData}>No participants attended this term.</Text>
      )}

      <Text style={styles.sectionLabel}>Facilitators</Text>
      {report.facilitators.length > 0 ? (
        <AttendanceTable people={report.facilitators} eventDates={report.eventDates} statusByPerson={report.statusByPerson} />
      ) : (
        <Text style={styles.noData}>No facilitators attended this term.</Text>
      )}
    </Page>
  );
}
