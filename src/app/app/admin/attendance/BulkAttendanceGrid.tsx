"use client";

import { useMemo, useState } from "react";
import { setAttendance } from "@/app/app/attendance/[categoryId]/[activityInstanceId]/session/actions";

type Attendee = { personId: string; name: string; preferredName: string | null };
type DateCol = { sessionDate: string; locked: boolean; cancelled: boolean };
type Status = "present" | "absent";

export type ActivityBlock = {
  id: string;
  name: string;
  categoryLabel: string | null;
  attendees: Attendee[];
  dates: DateCol[];
  statusByDatePerson: Record<string, Record<string, Status>>;
};

const NAME_COL_WIDTH = 170;
const DATE_COL_WIDTH = 44;
const ROW_HEIGHT = 36;

const nameCellStyle: React.CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  width: NAME_COL_WIDTH,
  minWidth: NAME_COL_WIDTH,
  maxWidth: NAME_COL_WIDTH,
  background: "var(--card-bg)",
  padding: "6px 8px",
  borderBottom: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  fontSize: "0.82rem",
  height: ROW_HEIGHT,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const dateCellStyle: React.CSSProperties = {
  width: DATE_COL_WIDTH,
  minWidth: DATE_COL_WIDTH,
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
  height: ROW_HEIGHT,
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatShort(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

export function BulkAttendanceGrid({ activities }: { activities: ActivityBlock[] }) {
  const [filterText, setFilterText] = useState("");
  const [statusByActivity, setStatusByActivity] = useState<Record<string, Record<string, Record<string, Status>>>>(() =>
    Object.fromEntries(activities.map((a) => [a.id, a.statusByDatePerson])),
  );
  const [error, setError] = useState<string | null>(null);

  // A match on the activity's own name/category means "show me this whole
  // roster" — but a match on a person's name means "show me just them",
  // even though the same person can turn up again under a different
  // activity they're also enrolled in.
  const visible = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return activities;
    const activityMatches = (a: ActivityBlock) => a.name.toLowerCase().includes(q) || (a.categoryLabel ?? "").toLowerCase().includes(q);
    const result: ActivityBlock[] = [];
    for (const a of activities) {
      if (activityMatches(a)) {
        result.push(a);
        continue;
      }
      const matchingAttendees = a.attendees.filter((p) => (p.preferredName || p.name).toLowerCase().includes(q));
      if (matchingAttendees.length > 0) result.push({ ...a, attendees: matchingAttendees });
    }
    return result;
  }, [activities, filterText]);

  // Admins can override both the non-admin edit window and a locked
  // session here — bulk edits are often exactly about backdating or
  // correcting data efficiently, which regularly means touching old or
  // already-confirmed sessions. setAttendance is already admin-unrestricted.
  function toggle(activityId: string, sessionDate: string, personId: string) {
    const current = statusByActivity[activityId]?.[sessionDate]?.[personId];
    const next: Status = current === "present" ? "absent" : "present";
    setError(null);
    setStatusByActivity((s) => ({
      ...s,
      [activityId]: { ...s[activityId], [sessionDate]: { ...s[activityId]?.[sessionDate], [personId]: next } },
    }));
    setAttendance(activityId, sessionDate, personId, next).catch((e) => {
      setStatusByActivity((s) => ({
        ...s,
        [activityId]: { ...s[activityId], [sessionDate]: { ...s[activityId]?.[sessionDate], [personId]: current } },
      }));
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    });
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--page-bg)", padding: "0 9px var(--space-3)" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 12 }}>
          Edit Attendance
        </h2>
        <input
          placeholder="Search by activity, category, attendee…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            width: 320,
            boxSizing: "border-box",
            fontSize: "0.85rem",
            minHeight: "var(--tap-min)",
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--card-bg)",
            color: "var(--text)",
          }}
        />
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 8 }}>
          Checked = present, unchecked = absent. As an admin, this overrides the lock icon shown on confirmed
          sessions — use with care.
        </p>
      </div>

      <div style={{ padding: "0 9px", display: "grid", gap: "var(--space-7)" }}>
        {visible.map((a) => (
          <ActivitySection key={a.id} activity={a} statusByDatePerson={statusByActivity[a.id] ?? {}} onToggle={toggle} />
        ))}
        {visible.length === 0 && <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No matching activities.</p>}
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: "0.8rem", padding: "0 9px" }}>{error}</p>}
    </div>
  );
}

function ActivitySection({
  activity,
  statusByDatePerson,
  onToggle,
}: {
  activity: ActivityBlock;
  statusByDatePerson: Record<string, Record<string, Status>>;
  onToggle: (activityId: string, sessionDate: string, personId: string) => void;
}) {
  return (
    <section>
      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.15rem", color: "var(--heading)", marginBottom: 8 }}>
        {activity.name}
        {activity.categoryLabel ? <span style={{ color: "var(--muted)", fontFamily: "inherit", fontSize: "0.85rem" }}> · {activity.categoryLabel}</span> : null}
      </h3>

      {activity.dates.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>No sessions recorded yet.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
          <table style={{ borderCollapse: "collapse", background: "var(--card-bg)" }}>
            <thead>
              <tr>
                <th style={{ ...nameCellStyle, zIndex: 2, background: "var(--table-header-bg)", textAlign: "left", fontWeight: 500 }}>Name</th>
                {activity.dates.map((d) => (
                  <th
                    key={d.sessionDate}
                    title={d.cancelled ? "Class cancelled — no attendance" : undefined}
                    style={{
                      ...dateCellStyle,
                      background: "var(--table-header-bg)",
                      fontWeight: 500,
                      fontSize: "0.65rem",
                      padding: "4px 2px",
                      color: d.cancelled ? "var(--red)" : undefined,
                      textDecoration: d.cancelled ? "line-through" : undefined,
                    }}
                  >
                    {formatShort(d.sessionDate)}
                    {d.locked && !d.cancelled && <LockGlyph />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.attendees.map((p) => (
                <tr key={p.personId}>
                  <td style={nameCellStyle}>{p.preferredName || p.name}</td>
                  {activity.dates.map((d) => {
                    const status = statusByDatePerson[d.sessionDate]?.[p.personId];
                    return (
                      <td key={d.sessionDate} style={dateCellStyle}>
                        {d.cancelled ? (
                          <span style={{ color: "var(--muted)", fontSize: "0.7rem" }} title="Class cancelled">
                            —
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={status === "present"}
                            onChange={() => onToggle(activity.id, d.sessionDate, p.personId)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LockGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "2px auto 0" }}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
