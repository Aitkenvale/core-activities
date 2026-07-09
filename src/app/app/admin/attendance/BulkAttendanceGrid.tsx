"use client";

import { useMemo, useState } from "react";
import {
  setAttendance,
  setLockStatus,
  setCancelledStatus,
  enrollExistingPerson,
  quickAddPerson,
} from "@/app/app/attendance/[categoryId]/[activityInstanceId]/session/actions";
import { addAttendanceDate } from "./actions";
import { PeoplePicker, type PickedPerson } from "@/app/app/activities/PeoplePicker";

type Attendee = { personId: string; name: string; preferredName: string | null };
type DateCol = { sessionDate: string; locked: boolean; cancelled: boolean };
type Status = "present" | "absent";

export type ActivityBlock = {
  id: string;
  categoryId: string;
  name: string;
  categoryLabel: string | null;
  attendees: Attendee[];
  dates: DateCol[];
  statusByDatePerson: Record<string, Record<string, Status>>;
};

const NAME_COL_WIDTH = 170;
// Wider than a bare date needs, to fit the Confirm/Cancel icon buttons
// underneath without wrapping.
const DATE_COL_WIDTH = 60;
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

// Hardcoded for now, matching the category IDs used elsewhere (PSEC/JYSEP/SC
// abbreviations) — expand this list as more categories come into use.
const CATEGORY_FILTER_OPTIONS = ["psec", "jysep", "sc"];

export function BulkAttendanceGrid({ initialActivities }: { initialActivities: ActivityBlock[] }) {
  const [activities, setActivities] = useState(initialActivities);
  const [filterText, setFilterText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [statusByActivity, setStatusByActivity] = useState<Record<string, Record<string, Record<string, Status>>>>(() =>
    Object.fromEntries(initialActivities.map((a) => [a.id, a.statusByDatePerson])),
  );
  const [error, setError] = useState<string | null>(null);
  const [enrolModalFor, setEnrolModalFor] = useState<ActivityBlock | null>(null);

  function toggleCategory(categoryId: string) {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  // A match on the activity's own name/category means "show me this whole
  // roster" — but a match on a person's name means "show me just them",
  // even though the same person can turn up again under a different
  // activity they're also enrolled in.
  const visible = useMemo(() => {
    const byCategory = categoryFilter.size === 0 ? activities : activities.filter((a) => categoryFilter.has(a.categoryId));
    const q = filterText.trim().toLowerCase();
    if (!q) return byCategory;
    const activityMatches = (a: ActivityBlock) => a.name.toLowerCase().includes(q) || (a.categoryLabel ?? "").toLowerCase().includes(q);
    const result: ActivityBlock[] = [];
    for (const a of byCategory) {
      if (activityMatches(a)) {
        result.push(a);
        continue;
      }
      const matchingAttendees = a.attendees.filter((p) => (p.preferredName || p.name).toLowerCase().includes(q));
      if (matchingAttendees.length > 0) result.push({ ...a, attendees: matchingAttendees });
    }
    return result;
  }, [activities, filterText, categoryFilter]);

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

  function patchDate(activityId: string, sessionDate: string, patch: Partial<DateCol>) {
    setActivities((acts) =>
      acts.map((a) => (a.id === activityId ? { ...a, dates: a.dates.map((d) => (d.sessionDate === sessionDate ? { ...d, ...patch } : d)) } : a)),
    );
  }

  function toggleLocked(activityId: string, sessionDate: string, next: boolean) {
    setError(null);
    patchDate(activityId, sessionDate, { locked: next });
    setLockStatus(activityId, sessionDate, next).catch((e) => {
      patchDate(activityId, sessionDate, { locked: !next });
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    });
  }

  // Cancelling is only offered while every checkbox for that date is clear
  // (enforced by the caller disabling the control) — but reversing a
  // mistaken cancel is always allowed, since nothing was lost by cancelling
  // in the first place.
  function toggleCancelled(activityId: string, sessionDate: string, next: boolean) {
    setError(null);
    patchDate(activityId, sessionDate, { cancelled: next });
    setCancelledStatus(activityId, sessionDate, next).catch((e) => {
      patchDate(activityId, sessionDate, { cancelled: !next });
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    });
  }

  async function handleAddDate(activityId: string, sessionDate: string) {
    setError(null);
    try {
      await addAttendanceDate(activityId, sessionDate);
      setActivities((acts) =>
        acts.map((a) => {
          if (a.id !== activityId) return a;
          if (a.dates.some((d) => d.sessionDate === sessionDate)) return a;
          const dates = [...a.dates, { sessionDate, locked: false, cancelled: false }].sort((x, y) => y.sessionDate.localeCompare(x.sessionDate));
          return { ...a, dates };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that date.");
    }
  }

  function addAttendeesLocal(activityId: string, newAttendees: Attendee[]) {
    setActivities((acts) =>
      acts.map((a) => {
        if (a.id !== activityId) return a;
        const merged = [...a.attendees, ...newAttendees].sort((x, y) => (x.preferredName || x.name).localeCompare(y.preferredName || y.name));
        return { ...a, attendees: merged };
      }),
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--page-bg)", padding: "0 9px var(--space-3)" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 12 }}>
          Edit Attendance
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
          {CATEGORY_FILTER_OPTIONS.map((categoryId) => (
            <button
              key={categoryId}
              onClick={() => toggleCategory(categoryId)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: `1px solid ${categoryFilter.has(categoryId) ? "var(--deep)" : "var(--border)"}`,
                background: categoryFilter.has(categoryId) ? "var(--deep)" : "var(--card-bg)",
                color: categoryFilter.has(categoryId) ? "var(--cream)" : "var(--muted)",
                fontSize: "0.75rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {categoryId}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 9px", display: "grid", gap: "var(--space-7)" }}>
        {visible.map((a) => (
          <ActivitySection
            key={a.id}
            activity={a}
            statusByDatePerson={statusByActivity[a.id] ?? {}}
            onToggle={toggle}
            onAddDate={handleAddDate}
            onToggleLocked={toggleLocked}
            onToggleCancelled={toggleCancelled}
            onOpenEnrol={setEnrolModalFor}
          />
        ))}
        {visible.length === 0 && <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No matching activities.</p>}
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: "0.8rem", padding: "0 9px" }}>{error}</p>}

      {enrolModalFor && (
        <EnrolAttendeesModal
          activity={enrolModalFor}
          onClose={() => setEnrolModalFor(null)}
          onEnrolled={(newAttendees) => {
            addAttendeesLocal(enrolModalFor.id, newAttendees);
            setEnrolModalFor(null);
          }}
        />
      )}
    </div>
  );
}

function ActivitySection({
  activity,
  statusByDatePerson,
  onToggle,
  onAddDate,
  onToggleLocked,
  onToggleCancelled,
  onOpenEnrol,
}: {
  activity: ActivityBlock;
  statusByDatePerson: Record<string, Record<string, Status>>;
  onToggle: (activityId: string, sessionDate: string, personId: string) => void;
  onAddDate: (activityId: string, sessionDate: string) => void;
  onToggleLocked: (activityId: string, sessionDate: string, next: boolean) => void;
  onToggleCancelled: (activityId: string, sessionDate: string, next: boolean) => void;
  onOpenEnrol: (activity: ActivityBlock) => void;
}) {
  return (
    <section>
      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.15rem", color: "var(--heading)", marginBottom: 8 }}>
        {activity.name}
        {activity.categoryLabel ? <span style={{ color: "var(--muted)", fontFamily: "inherit", fontSize: "0.85rem" }}> · {activity.categoryLabel}</span> : null}
      </h3>

      {activity.attendees.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
          No one enrolled yet —{" "}
          <button
            onClick={() => onOpenEnrol(activity)}
            style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "var(--warm)", textDecoration: "underline", cursor: "pointer" }}
          >
            enrol participants
          </button>{" "}
          before backdating attendance.
        </p>
      ) : (
        <>
          {activity.dates.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>No sessions recorded yet.</p>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
              <table style={{ borderCollapse: "collapse", background: "var(--card-bg)" }}>
                <thead>
                  <tr>
                    <th style={{ ...nameCellStyle, zIndex: 2, background: "var(--table-header-bg)", textAlign: "left", fontWeight: 500 }}>Name</th>
                    {activity.dates.map((d) => {
                      const dateStatuses = statusByDatePerson[d.sessionDate] ?? {};
                      const anyChecked = activity.attendees.some((p) => dateStatuses[p.personId] === "present");
                      // Cancelling would otherwise silently orphan whatever's
                      // already checked — only offer it while every box for
                      // this date is clear. Reversing a cancel is always
                      // allowed, since nothing was lost by cancelling.
                      const canCancel = d.cancelled || !anyChecked;
                      return (
                        <th
                          key={d.sessionDate}
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
                          <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 3 }}>
                            <button
                              onClick={() => onToggleLocked(activity.id, d.sessionDate, !d.locked)}
                              title={d.locked ? "Unconfirm this session" : "Confirm this session"}
                              style={iconButtonStyle(d.locked, "var(--green)")}
                            >
                              <LockGlyph />
                            </button>
                            <button
                              onClick={() => canCancel && onToggleCancelled(activity.id, d.sessionDate, !d.cancelled)}
                              disabled={!canCancel}
                              title={
                                d.cancelled
                                  ? "Un-cancel this session"
                                  : canCancel
                                    ? "Cancel this session"
                                    : "Clear every checkbox for this date before cancelling"
                              }
                              style={{ ...iconButtonStyle(d.cancelled, "var(--red)"), opacity: canCancel ? 1 : 0.35 }}
                            >
                              <CancelGlyph />
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activity.attendees.map((p) => {
                    const presentCount = activity.dates.filter((d) => statusByDatePerson[d.sessionDate]?.[p.personId] === "present").length;
                    return (
                      <tr key={p.personId}>
                        <td style={nameCellStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{p.preferredName || p.name}</span>
                            <span style={{ flexShrink: 0, color: "var(--muted)", fontSize: "0.75rem" }}>{presentCount}</span>
                          </div>
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <AddDateControl activityId={activity.id} onAddDate={onAddDate} />
        </>
      )}
    </section>
  );
}

// Lets an admin create a session date directly — for backdating a whole
// activity's history (or one that was never tracked in the app at all)
// rather than being limited to whatever dates already happen to exist.
function AddDateControl({ activityId, onAddDate }: { activityId: string; onAddDate: (activityId: string, sessionDate: string) => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 8,
          padding: "4px 12px",
          border: "1px dashed var(--gold)",
          borderRadius: "var(--radius-sm)",
          background: "none",
          color: "var(--warm)",
          fontSize: "0.75rem",
          cursor: "pointer",
        }}
      >
        + Add Date
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{
          fontSize: "0.8rem",
          padding: "4px 6px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--card-bg)",
          color: "var(--text)",
        }}
      />
      <button
        onClick={() => {
          if (!date) return;
          onAddDate(activityId, date);
          setDate("");
          setOpen(false);
        }}
        disabled={!date}
        style={{
          padding: "4px 14px",
          borderRadius: "var(--radius-pill)",
          border: "none",
          background: "var(--deep)",
          color: "var(--cream)",
          fontSize: "0.75rem",
          cursor: "pointer",
        }}
      >
        Add
      </button>
      <button
        onClick={() => setOpen(false)}
        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer" }}
      >
        Cancel
      </button>
    </div>
  );
}

// Only offered while an activity has zero attendees (see the "enrol
// participants" trigger above) — Edit Activity's own roster is read-only to
// protect attendance history, but there's no history to protect here yet,
// so a plain add-only popup (kept in the admin view, unlike the old link
// out to the user-facing session page) is all that's needed.
function EnrolAttendeesModal({
  activity,
  onClose,
  onEnrolled,
}: {
  activity: ActivityBlock;
  onClose: () => void;
  onEnrolled: (newAttendees: Attendee[]) => void;
}) {
  const [facilitators, setFacilitators] = useState<PickedPerson[]>([]);
  const [participants, setParticipants] = useState<PickedPerson[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enrolList(list: PickedPerson[], role: "facilitator" | "participant"): Promise<Attendee[]> {
    const created: Attendee[] = [];
    for (const p of list) {
      if (p.kind === "existing") {
        await enrollExistingPerson(activity.id, p.id, role);
        created.push({ personId: p.id, name: p.name, preferredName: p.preferredName });
      } else {
        const row = await quickAddPerson(activity.id, p.name, role);
        created.push({ personId: row.id, name: row.name, preferredName: row.preferredName });
      }
    }
    return created;
  }

  async function handleSubmit() {
    if (facilitators.length === 0 && participants.length === 0) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const a = await enrolList(facilitators, "facilitator");
      const b = await enrolList(participants, "participant");
      onEnrolled([...a, ...b]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enrol attendees.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-6)",
          width: "min(90vw, 480px)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", color: "var(--heading)", marginBottom: "var(--space-4)" }}>
          Enrol Attendees — {activity.name}
        </h3>
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <PeoplePicker label="Facilitators" role="facilitator" selected={facilitators} onChange={setFacilitators} />
          <PeoplePicker label="Participants" role="participant" selected={participants} onChange={setParticipants} />
          {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer", padding: "8px 12px" }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ background: "var(--deep)", color: "var(--cream)", border: "none", borderRadius: 2, padding: "8px 20px", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {submitting ? "Enrolling…" : "Enrol"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function iconButtonStyle(active: boolean, activeColor: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    padding: 0,
    border: `1px solid ${active ? activeColor : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    background: active ? activeColor : "var(--card-bg)",
    color: active ? "var(--cream)" : "var(--muted)",
    cursor: "pointer",
  };
}

function LockGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function CancelGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
