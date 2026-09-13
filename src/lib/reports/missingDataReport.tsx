import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { activityEnrollments } from "@/db/schema/activityEnrollments";
import { activityInstances } from "@/db/schema/activityInstances";
import { activityCategories } from "@/db/schema/activityCategories";
import { attendanceEvents } from "@/db/schema/attendanceEvents";
import { attendanceRecords } from "@/db/schema/attendanceRecords";
import { people } from "@/db/schema/people";
import { households } from "@/db/schema/households";
import { calculateAge } from "@/lib/category";

type PersonRow = {
  personName: string;
  missing: string[];
};

type ActivityGroup = {
  activityName: string;
  people: PersonRow[];
};

type CategoryGroup = {
  categoryLabel: string;
  activities: ActivityGroup[];
};

function fourWeeksAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  return d.toISOString().slice(0, 10);
}

// Only these 5 items are ever checked — the report is deliberately narrow
// (essential info only), not a full completeness audit.
function missingFieldsFor(row: {
  name: string;
  regoYear: number | null;
  regoFormUrl: string | null;
  householdId: string | null;
  householdContactPersonId: string | null;
  householdContactMobile: string | null;
}): string[] {
  const missing: string[] = [];
  // No dedicated surname column — a name with no second word has no
  // surname on file, which is what this is actually standing in for.
  if (!row.name.trim().includes(" ")) missing.push("Surname");
  if (!row.regoYear && !row.regoFormUrl) missing.push("Rego");
  if (!row.householdId) missing.push("Household");
  if (!row.householdContactPersonId) missing.push("Household Contact");
  if (!row.householdContactMobile) missing.push("Household Contact Mobile");
  return missing;
}

// Current participants (active roster entry, on an active/non-hidden
// activity) who've actually attended that specific activity at least twice
// in the last 4 weeks — same "actually attended, not just enrolled"
// reasoning as the Family Visit Planner, just a shorter window and a >=2 count
// instead of >=1. Every category is included (not just PSEC/JYSEP), grouped
// by category then activity, and only people missing at least one of the 5
// essential fields are kept. Under-4s are excluded entirely (see the age
// check in the loop below).
async function getMissingDataGroups(): Promise<CategoryGroup[]> {
  const householdContacts = alias(people, "household_contacts");
  const cutoff = fourWeeksAgoIso();

  // A scalar subquery (not exists()) since this needs an actual count
  // threshold (>=2), not just "attended at all" — same tables/columns as
  // the Family Visit Planner's exists() check, just counted instead.
  const attendedTwicePlus = sql`(
    select count(*) from ${attendanceRecords}
    inner join ${attendanceEvents} on ${attendanceEvents.id} = ${attendanceRecords.attendanceEventId}
    where ${attendanceRecords.personId} = ${people.id}
      and ${attendanceEvents.activityInstanceId} = ${activityInstances.id}
      and ${attendanceRecords.status} = 'present'
      and ${attendanceEvents.sessionDate} >= ${cutoff}
  ) >= 2`;

  const rows = await db
    .select({
      categoryLabel: activityCategories.label,
      categorySortOrder: activityCategories.sortOrder,
      activityName: activityInstances.name,
      personName: people.name,
      dob: people.dob,
      regoYear: people.regoYear,
      regoFormUrl: people.regoFormUrl,
      householdId: people.householdId,
      householdContactPersonId: households.contactPersonId,
      householdContactMobile: householdContacts.mobile,
    })
    .from(activityEnrollments)
    .innerJoin(people, eq(people.id, activityEnrollments.personId))
    .innerJoin(activityInstances, eq(activityInstances.id, activityEnrollments.activityInstanceId))
    .innerJoin(activityCategories, eq(activityCategories.id, activityInstances.categoryId))
    .leftJoin(households, eq(households.id, people.householdId))
    .leftJoin(householdContacts, eq(householdContacts.id, households.contactPersonId))
    .where(
      and(
        eq(activityEnrollments.role, "participant"),
        eq(activityEnrollments.active, true),
        eq(activityInstances.status, "active"),
        eq(activityInstances.hidden, false),
        eq(people.hidden, false),
        attendedTwicePlus,
      ),
    )
    .orderBy(asc(activityCategories.sortOrder), asc(activityInstances.name), asc(people.name));

  const categories = new Map<string, CategoryGroup>();
  for (const r of rows) {
    // Too young for this report's essential-info checks to be meaningful
    // yet (rego/household paperwork for a toddler isn't the same urgency as
    // for an enrolled program participant) — an unknown DOB isn't excluded,
    // since we can't confirm they're actually under 4.
    if (r.dob && calculateAge(r.dob) < 4) continue;

    const missing = missingFieldsFor({ ...r, name: r.personName });
    if (missing.length === 0) continue;

    if (!categories.has(r.categoryLabel)) categories.set(r.categoryLabel, { categoryLabel: r.categoryLabel, activities: [] });
    const category = categories.get(r.categoryLabel)!;

    let activity = category.activities.find((a) => a.activityName === r.activityName);
    if (!activity) {
      activity = { activityName: r.activityName, people: [] };
      category.activities.push(activity);
    }
    activity.people.push({ personName: r.personName, missing });
  }

  return Array.from(categories.values());
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 15, marginBottom: 2 },
  subtitle: { fontSize: 8.5, color: "#6B4C2A", marginBottom: 14 },
  categoryHeader: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 4 },
  activityHeader: { fontSize: 9.5, fontWeight: 700, backgroundColor: "#F3EDE1", padding: "3pt 5pt", marginBottom: 2 },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #D9C9A8", padding: "3pt 5pt" },
  name: { width: 160 },
  missing: { flex: 1, color: "#8A3B2A" },
  empty: { fontSize: 10, color: "#6B4C2A", marginTop: 20 },
});

export async function generateMissingDataReportPdf(): Promise<Buffer> {
  const groups = await getMissingDataGroups();
  const totalPeople = groups.reduce((sum, c) => sum + c.activities.reduce((s, a) => s + a.people.length, 0), 0);

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Missing Data Report</Text>
        <Text style={styles.subtitle}>
          Current participants aged 4+ who&rsquo;ve attended twice or more in the last 4 weeks, grouped by activity,
          with any missing essential information (surname, rego, household, household contact, household contact
          mobile).
        </Text>
        {totalPeople === 0 && <Text style={styles.empty}>Nothing missing — every recently-active participant is fully on file.</Text>}
        {groups.map((category) => (
          <View key={category.categoryLabel}>
            <Text style={styles.categoryHeader}>{category.categoryLabel}</Text>
            {category.activities.map((activity) => (
              <View key={activity.activityName} wrap={false}>
                <Text style={styles.activityHeader}>{activity.activityName}</Text>
                {activity.people.map((p, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.name}>{p.personName}</Text>
                    <Text style={styles.missing}>Missing: {p.missing.join(", ")}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>,
  );
}
