import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { termDates } from "@/db/schema/termDates";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { activityEnrollmentRoleHistory } from "@/db/schema/activityEnrollmentRoleHistory";
import { people } from "@/db/schema/people";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { getRoleLabels } from "@/lib/activityRoleLabels";

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

// Present / Absent / No data are three distinct, deliberately different
// marks — a blank cell means nobody ever recorded this person's attendance
// for that session at all, which reads differently from a recorded Absent.
function markForStatus(status: string | undefined): string {
  if (status === "present") return "X";
  if (status === "absent") return "—";
  return "";
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

// roleDates is only set for Facilitator/Assistant rows — the subset of
// eventDates this person actually held *this* role on, per their role
// history. undefined (Participants) means "every date applies", same as
// before role history existed.
type RosterPerson = { personId: string; name: string; roleDates?: Set<string> };

// Which role (if any) was in effect on a given date, from a person's role
// history — the entry with the latest effectiveFrom that's still <= date.
// No entry at all for that date (e.g. before they were ever a Facilitator/
// Assistant) returns null, so it counts toward neither table.
function roleOnDate(history: { role: string; effectiveFrom: string }[], date: string): string | null {
  let best: { role: string; effectiveFrom: string } | null = null;
  for (const h of history) {
    if (h.effectiveFrom <= date && (!best || h.effectiveFrom > best.effectiveFrom)) best = h;
  }
  return best?.role ?? null;
}

type ActivityReport = {
  activityName: string;
  categoryId: string;
  categoryLabel: string;
  eventDates: string[];
  participants: RosterPerson[];
  facilitators: RosterPerson[];
  assistants: RosterPerson[];
  // personId -> sessionDate -> "present" | "absent"
  statusByPerson: Map<string, Map<string, string>>;
};

async function buildActivityReport(
  activityId: string,
  activityName: string,
  categoryId: string,
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
    .select({ enrollmentId: activityEnrollments.id, personId: people.id, name: people.name, role: activityEnrollments.role })
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
  // never actually marked present this term doesn't get a row. Optionally
  // scoped to a subset of dates, for a Facilitator/Assistant row that
  // should only count sessions where they actually held that role.
  function attendedAtLeastOnce(personId: string, dates?: Set<string>): boolean {
    const byDate = statusByPerson.get(personId);
    if (!byDate) return false;
    for (const [date, status] of byDate) {
      if (status === "present" && (!dates || dates.has(date))) return true;
    }
    return false;
  }

  const byName = (a: RosterPerson, b: RosterPerson) => a.name.localeCompare(b.name);
  const participants = roster.filter((r) => r.role === "participant" && attendedAtLeastOnce(r.personId)).sort(byName);

  // Facilitator/Assistant is a point-in-time classification (see
  // activity_enrollment_role_history) — a person promoted or demoted
  // mid-term needs to show up as a row in *both* tables, each one only
  // marked for the sessions where that role actually applied, so a report
  // pulled after a later change doesn't retroactively rewrite this term.
  const roleEnrollmentIds = roster.filter((r) => r.role === "facilitator" || r.role === "assistant").map((r) => r.enrollmentId);
  const historyRows = roleEnrollmentIds.length
    ? await db
        .select({ enrollmentId: activityEnrollmentRoleHistory.enrollmentId, role: activityEnrollmentRoleHistory.role, effectiveFrom: activityEnrollmentRoleHistory.effectiveFrom })
        .from(activityEnrollmentRoleHistory)
        .where(inArray(activityEnrollmentRoleHistory.enrollmentId, roleEnrollmentIds))
    : [];
  const historyByEnrollment = new Map<string, { role: string; effectiveFrom: string }[]>();
  for (const h of historyRows) {
    if (!historyByEnrollment.has(h.enrollmentId)) historyByEnrollment.set(h.enrollmentId, []);
    historyByEnrollment.get(h.enrollmentId)!.push({ role: h.role, effectiveFrom: h.effectiveFrom });
  }

  const facilitators: RosterPerson[] = [];
  const assistants: RosterPerson[] = [];
  for (const r of roster) {
    if (r.role !== "facilitator" && r.role !== "assistant") continue;
    const history = historyByEnrollment.get(r.enrollmentId) ?? [];
    const facilitatorDates = new Set<string>();
    const assistantDates = new Set<string>();
    for (const date of events.map((e) => e.sessionDate)) {
      // No history row at all (shouldn't happen post-backfill, but don't
      // silently drop someone over it) falls back to their current role
      // for every date, same as before role history existed.
      const role = history.length > 0 ? roleOnDate(history, date) : r.role;
      if (role === "facilitator") facilitatorDates.add(date);
      else if (role === "assistant") assistantDates.add(date);
    }
    if (facilitatorDates.size > 0 && attendedAtLeastOnce(r.personId, facilitatorDates)) {
      facilitators.push({ personId: r.personId, name: r.name, roleDates: facilitatorDates });
    }
    if (assistantDates.size > 0 && attendedAtLeastOnce(r.personId, assistantDates)) {
      assistants.push({ personId: r.personId, name: r.name, roleDates: assistantDates });
    }
  }
  facilitators.sort(byName);
  assistants.sort(byName);
  if (participants.length === 0 && facilitators.length === 0 && assistants.length === 0) return null;

  return {
    activityName,
    categoryId,
    categoryLabel,
    eventDates: events.map((e) => e.sessionDate),
    participants,
    facilitators,
    assistants,
    statusByPerson,
  };
}

export async function generateAttendanceReportPdf(year: number, termNumber: number): Promise<Buffer> {
  const termsWithNextStart = await getTermsWithNextStart();
  const match = termsWithNextStart.find(({ term }) => term.year === year && term.termNumber === termNumber);
  if (!match) throw new Error("That term isn't available — either it doesn't exist, or the next term's start date isn't set yet.");
  const { term, rangeEnd } = match;

  // Every activity, regardless of its current hidden/status — an activity
  // that's since been ended/hidden (or paused) can still have had real
  // sessions during this term, and a past report shouldn't silently drop
  // them just because of what the activity looks like today. Whether it
  // actually belongs in this report comes down to whether it has any
  // attendance_events in range at all, which buildActivityReport already
  // checks below (returns null — no page — if there are none).
  const [activities, categories] = await Promise.all([
    db.select().from(activityInstances).orderBy(asc(activityInstances.name)),
    db.select().from(activityCategories),
  ]);
  const categoryLabel = Object.fromEntries(categories.map((c) => [c.id, c.label]));

  const reports: ActivityReport[] = [];
  for (const activity of activities) {
    const report = await buildActivityReport(
      activity.id,
      activity.name,
      activity.categoryId,
      categoryLabel[activity.categoryId] ?? activity.categoryId,
      term.startDate,
      rangeEnd,
    );
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
  footnote: { fontSize: 7, color: "#555555", marginTop: 3 },
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
                {/* Present/Absent/No data must read as three distinct
                    states, not two — a blank cell here means no attendance
                    was ever recorded for this person on this date (the
                    session existed, but nobody marked them either way),
                    which is different from a recorded Absent. "X" not "✓"
                    for Present — the checkmark glyph isn't in the built-in
                    Helvetica encoding react-pdf uses, so it silently
                    rendered as nothing. A Facilitator/Assistant row also
                    blanks any date outside their roleDates — a session
                    where they held the *other* role that term, not a
                    missed mark. */}
                {p.roleDates && !p.roleDates.has(d) ? "" : markForStatus(byDate?.get(d))}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function ActivityPage({ term, rangeEnd, report }: { term: TermOption; rangeEnd: string; report: ActivityReport }) {
  const roleLabels = getRoleLabels(report.categoryId);
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

      <Text style={styles.sectionLabel}>{roleLabels.facilitator}</Text>
      {report.facilitators.length > 0 ? (
        <AttendanceTable people={report.facilitators} eventDates={report.eventDates} statusByPerson={report.statusByPerson} />
      ) : (
        <Text style={styles.noData}>No {roleLabels.facilitator.toLowerCase()} attended this term.</Text>
      )}

      {roleLabels.showAssistants && (
        <>
          <Text style={styles.sectionLabel}>{roleLabels.assistant}*</Text>
          {report.assistants.length > 0 ? (
            <AttendanceTable people={report.assistants} eventDates={report.eventDates} statusByPerson={report.statusByPerson} />
          ) : (
            <Text style={styles.noData}>No {roleLabels.assistant.toLowerCase()} attended this term.</Text>
          )}
          <Text style={styles.footnote}>* Not responsible in any way for under 18s. Assisting under supervision.</Text>
        </>
      )}
    </Page>
  );
}
