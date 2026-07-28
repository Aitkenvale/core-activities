import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";

export type SchoolActivityOption = { id: string; name: string; categoryId: string; categoryLabel: string };

// Every PSEC/JYSEP activity currently running — hidden/archived ones are
// left off since a school report is about who's attending now, not a
// historical record of every class that ever existed.
export async function getSchoolActivityOptions(): Promise<SchoolActivityOption[]> {
  const categories = await db.select().from(activityCategories);
  const categoryLabel = Object.fromEntries(categories.map((c) => [c.id, c.label]));

  const rows = await db
    .select({ id: activityInstances.id, name: activityInstances.name, categoryId: activityInstances.categoryId })
    .from(activityInstances)
    .where(and(inArray(activityInstances.categoryId, ["psec", "jysep"]), eq(activityInstances.hidden, false)))
    .orderBy(asc(activityInstances.name));

  return rows.map((r) => ({ ...r, categoryLabel: categoryLabel[r.categoryId] ?? r.categoryId.toUpperCase() }));
}

type ActivityRoster = {
  activityName: string;
  categoryLabel: string;
  rows: { participantName: string; contactName: string | null }[];
};

async function buildActivityRoster(activityId: string, activityName: string, categoryLabel: string): Promise<ActivityRoster> {
  const householdContacts = alias(people, "household_contacts");

  const roster = await db
    .select({ participantName: people.name, contactName: householdContacts.name })
    .from(activityEnrollments)
    .innerJoin(people, eq(people.id, activityEnrollments.personId))
    .leftJoin(households, eq(households.id, people.householdId))
    .leftJoin(householdContacts, eq(householdContacts.id, households.contactPersonId))
    .where(
      and(
        eq(activityEnrollments.activityInstanceId, activityId),
        eq(activityEnrollments.role, "participant"),
        eq(activityEnrollments.active, true),
        eq(people.hidden, false),
      ),
    )
    .orderBy(asc(people.name));

  return { activityName, categoryLabel, rows: roster };
}

// One page per selected activity, listing every active participant's full
// name alongside their household's contact — the two things a school needs
// to know who's attending and who to reach about them. No attendance
// history here (see attendanceReport.tsx for that) — this is a current
// roster snapshot, generated on demand.
export async function generateSchoolAttendanceReportPdf(activityIds: string[]): Promise<Buffer> {
  if (activityIds.length === 0) throw new Error("Select at least one activity.");

  const options = await getSchoolActivityOptions();
  const byId = new Map(options.map((o) => [o.id, o]));
  const selected = activityIds.map((id) => byId.get(id)).filter((o): o is SchoolActivityOption => Boolean(o));
  if (selected.length === 0) throw new Error("None of the selected activities could be found.");

  const rosters = await Promise.all(selected.map((a) => buildActivityRoster(a.id, a.name, a.categoryLabel)));

  return renderToBuffer(
    <Document>
      {rosters.map((r) => (
        <RosterPage key={r.activityName} roster={r} />
      ))}
    </Document>,
  );
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#6B4C2A", marginBottom: 16 },
  table: { borderTop: "1pt solid #D9C9A8", borderLeft: "1pt solid #D9C9A8" },
  row: { flexDirection: "row" },
  headerCell: { flex: 1, padding: "4pt 6pt", borderRight: "1pt solid #D9C9A8", borderBottom: "1pt solid #D9C9A8", fontSize: 8, backgroundColor: "#F3EDE1" },
  cell: { flex: 1, padding: "4pt 6pt", borderRight: "1pt solid #D9C9A8", borderBottom: "1pt solid #D9C9A8" },
  noData: { fontSize: 9, color: "#777777", marginTop: 6 },
});

function RosterPage({ roster }: { roster: ActivityRoster }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>{roster.activityName}</Text>
      <Text style={styles.subtitle}>{roster.categoryLabel}</Text>

      {roster.rows.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.headerCell}>Participant</Text>
            <Text style={styles.headerCell}>Household Contact</Text>
          </View>
          {roster.rows.map((r, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={styles.cell}>{r.participantName}</Text>
              <Text style={styles.cell}>{r.contactName || "—"}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noData}>No active participants on this activity.</Text>
      )}
    </Page>
  );
}
