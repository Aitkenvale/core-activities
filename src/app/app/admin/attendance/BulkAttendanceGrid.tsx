"use client";

import { useMemo, useState } from "react";
import { setAttendance } from "@/app/app/attendance/[categoryId]/[activityInstanceId]/session/actions";

type Participant = { personId: string; name: string; preferredName: string | null };
type DateCol = { sessionDate: string; locked: boolean };
type Status = "present" | "absent";

export type ActivityBlock = {
  id: string;
  name: string;
  categoryLabel: string | null;
  participants: Participant[];
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

  const visible = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.categoryLabel ?? "").toLowerCase().includes(q) ||
        a.participants.some((p) => (p.preferredName || p.name).toLowerCase().includes(q)),
    );
  }, [activities, filterText]);

  function toggle(activityId: string, sessionDate: string, personId: string, locked: boolean) {
    if (locked) return;
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
          Bulk Edit Attendance
        </h2>
        <input
          placeholder="Search by activity, category, participant…"
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
          Checked = present. Unchecked covers both absent and never-recorded — open a single session to see which. Locked
          sessions are read-only here; unlock them from the session view to edit.
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
  onToggle: (activityId: string, sessionDate: string, personId: string, locked: boolean) => void;
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
                  <th key={d.sessionDate} style={{ ...dateCellStyle, background: "var(--table-header-bg)", fontWeight: 500, fontSize: "0.65rem", padding: "4px 2px" }}>
                    {formatShort(d.sessionDate)}
                    {d.locked && <LockGlyph />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.participants.map((p) => (
                <tr key={p.personId}>
                  <td style={nameCellStyle}>{p.preferredName || p.name}</td>
                  {activity.dates.map((d) => {
                    const status = statusByDatePerson[d.sessionDate]?.[p.personId];
                    return (
                      <td key={d.sessionDate} style={dateCellStyle}>
                        <input
                          type="checkbox"
                          checked={status === "present"}
                          disabled={d.locked}
                          onChange={() => onToggle(activity.id, d.sessionDate, p.personId, d.locked)}
                        />
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
