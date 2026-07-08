"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  setAttendance,
  setEnrollmentActive,
  searchPeople,
  enrollExistingPerson,
  quickAddPerson,
  getLockStatus,
  setLockStatus,
} from "./actions";

type RosterRow = {
  personId: string;
  name: string;
  preferredName: string | null;
  linkStatus: "linked" | "pending";
  role: "participant" | "facilitator";
  active: boolean;
};

type Status = "present" | "absent" | undefined;

export function SessionClient({
  categoryId,
  activityInstanceId,
  activityName,
  selectedDate,
  recentDates,
  roster,
  statusByPersonId,
}: {
  categoryId: string;
  activityInstanceId: string;
  activityName: string;
  selectedDate: string;
  recentDates: string[];
  roster: RosterRow[];
  statusByPersonId: Record<string, Status>;
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, Status>>(statusByPersonId);
  const [activeByPersonId, setActiveByPersonId] = useState<Record<string, boolean>>(
    Object.fromEntries(roster.map((r) => [r.personId, r.active])),
  );
  const [editMode, setEditMode] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pillSlot, setPillSlot] = useState<HTMLElement | null>(null);

  // Switching the date pill re-renders this component with new props (same
  // component instance, not a remount), so the initial useState value above
  // only applies on first load. Without this, attendance marks from the
  // first-viewed date stuck around no matter which date pill was tapped.
  useEffect(() => {
    setStatuses(statusByPersonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    getLockStatus(activityInstanceId, selectedDate).then(setLocked);
  }, [activityInstanceId, selectedDate]);

  useEffect(() => {
    setPillSlot(document.getElementById("lock-status-slot"));
  }, []);

  function goToDate(date: string) {
    router.push(`/app/attendance/${categoryId}/${activityInstanceId}/session?date=${date}`);
  }

  function toggle(personId: string, next: Status) {
    if (locked) return;
    setStatuses((s) => ({ ...s, [personId]: next }));
    if (next) startTransition(() => setAttendance(activityInstanceId, selectedDate, personId, next));
  }

  function toggleActive(personId: string) {
    const next = !activeByPersonId[personId];
    setActiveByPersonId((s) => ({ ...s, [personId]: next }));
    startTransition(() => setEnrollmentActive(activityInstanceId, personId, next));
  }

  function toggleLocked() {
    const next = !locked;
    setLocked(next);
    startTransition(() => setLockStatus(activityInstanceId, selectedDate, next));
  }

  const visible = (r: RosterRow) => editMode || activeByPersonId[r.personId];
  const participants = roster.filter((r) => r.role === "participant" && visible(r));
  const facilitators = roster.filter((r) => r.role === "facilitator" && visible(r));

  return (
    <>
      {pillSlot && createPortal(<LockStatusPill locked={locked} onToggle={toggleLocked} />, pillSlot)}

      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 4px" }}>
        {activityName}
      </h2>

      <DatePicker selectedDate={selectedDate} recentDates={recentDates} onPick={goToDate} />

      <RosterSection
        title="Participants"
        rows={participants}
        statuses={statuses}
        onToggle={toggle}
        activityInstanceId={activityInstanceId}
        role="participant"
        onChanged={() => router.refresh()}
        editMode={editMode}
        activeByPersonId={activeByPersonId}
        onToggleActive={toggleActive}
        locked={locked}
      />
      <RosterSection
        title="Facilitators"
        rows={facilitators}
        statuses={statuses}
        onToggle={toggle}
        activityInstanceId={activityInstanceId}
        role="facilitator"
        onChanged={() => router.refresh()}
        editMode={editMode}
        activeByPersonId={activeByPersonId}
        onToggleActive={toggleActive}
        locked={locked}
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-2)" }}>
        <button
          onClick={toggleLocked}
          disabled={locked}
          style={{
            minHeight: "var(--tap-min)",
            padding: "0 24px",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--green)",
            background: locked ? "var(--border)" : "var(--card-bg)",
            color: locked ? "var(--muted)" : "var(--green)",
            fontSize: "0.85rem",
            cursor: locked ? "default" : "pointer",
          }}
        >
          {locked ? "Confirmed" : "Confirm"}
        </button>
        <button
          onClick={() => setEditMode((v) => !v)}
          style={{
            minHeight: "var(--tap-min)",
            padding: "0 24px",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border)",
            background: editMode ? "var(--deep)" : "var(--card-bg)",
            color: editMode ? "var(--cream)" : "var(--text)",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          {editMode ? "Done" : "Edit"}
        </button>
      </div>

      {pending && <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 12 }}>Saving…</p>}
    </>
  );
}

function LockStatusPill({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: "6px 14px",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${locked ? "var(--red)" : "var(--green)"}`,
        background: locked ? "var(--red)" : "var(--card-bg)",
        color: locked ? "var(--cream)" : "var(--green)",
        fontSize: "0.7rem",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {locked ? "Locked" : "Unlocked"}
    </button>
  );
}

function DatePicker({
  selectedDate,
  recentDates,
  onPick,
}: {
  selectedDate: string;
  recentDates: string[];
  onPick: (date: string) => void;
}) {
  const pillStyle = {
    flexShrink: 0,
    minHeight: "var(--tap-min)",
    padding: "8px 16px",
    borderRadius: "var(--radius-pill)",
    fontSize: "0.8rem",
    cursor: "pointer",
    lineHeight: "normal",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ marginBottom: "var(--space-7)", display: "flex", alignItems: "stretch", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", gap: "var(--space-2)", overflowX: "auto", flex: 1 }}>
        {recentDates.map((d) => (
          <button
            key={d}
            onClick={() => onPick(d)}
            style={{
              ...pillStyle,
              border: "1px solid var(--border)",
              background: d === selectedDate ? "var(--deep)" : "var(--card-bg)",
              color: d === selectedDate ? "var(--cream)" : "var(--text)",
            }}
          >
            {formatShort(d)}
          </button>
        ))}
      </div>
      {/* The date input itself is the clickable element (opacity 0 but on
          top, so tapping it reliably opens the native picker on every
          browser) — a separate "Pick date" label sits visually on top with
          pointer-events disabled so clicks pass through to the input
          beneath it. Proxying via showPicker()/click() from a sibling
          button was unreliable on iOS Safari. */}
      <div style={{ position: "relative", flexShrink: 0, width: 104 }}>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && onPick(e.target.value)}
          style={{ ...pillStyle, width: "100%", height: "100%", opacity: 0, border: "none" }}
        />
        <div
          style={{
            ...pillStyle,
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            border: "1px dashed var(--gold)",
            background: "var(--cream2)",
            color: "var(--warm)",
            whiteSpace: "nowrap",
          }}
        >
          Pick date
        </div>
      </div>
    </div>
  );
}

// toLocaleDateString's "short" month can render the full month name on some
// devices/browsers (seen on iOS) — spell out the abbreviation ourselves so
// "16 Jun" is guaranteed everywhere.
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShort(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

function RosterSection({
  title,
  rows,
  statuses,
  onToggle,
  activityInstanceId,
  role,
  onChanged,
  editMode,
  activeByPersonId,
  onToggleActive,
  locked,
}: {
  title: string;
  rows: RosterRow[];
  statuses: Record<string, Status>;
  onToggle: (personId: string, status: Status) => void;
  activityInstanceId: string;
  role: "participant" | "facilitator";
  onChanged: () => void;
  editMode: boolean;
  activeByPersonId: Record<string, boolean>;
  onToggleActive: (personId: string) => void;
  locked: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
        {title}
      </h2>
      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        {rows.map((r) => {
          const isHidden = editMode && !activeByPersonId[r.personId];
          return (
            <div
              key={r.personId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: "var(--tap-min)",
                background: "var(--card-bg)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-card)",
                padding: "10px var(--space-4)",
                opacity: isHidden ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: "0.9rem" }}>
                {r.preferredName || r.name}
                {r.linkStatus === "pending" && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: "0.65rem",
                      color: "var(--warm)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "1px 6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Not linked
                  </span>
                )}
              </span>
              {editMode ? (
                <button
                  onClick={() => onToggleActive(r.personId)}
                  style={{
                    minHeight: 36,
                    padding: "0 var(--space-4)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: activeByPersonId[r.personId] ? "var(--card-bg)" : "var(--muted)",
                    color: activeByPersonId[r.personId] ? "var(--text)" : "var(--cream)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  {activeByPersonId[r.personId] ? "Hide" : "Show"}
                </button>
              ) : (
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    onClick={() => onToggle(r.personId, "present")}
                    disabled={locked}
                    style={{
                      minHeight: 36,
                      padding: "0 var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--green)",
                      background: statuses[r.personId] === "present" ? "var(--green)" : "var(--card-bg)",
                      color: statuses[r.personId] === "present" ? "var(--cream)" : "var(--green)",
                      fontSize: "0.75rem",
                      cursor: locked ? "default" : "pointer",
                      opacity: locked ? 0.6 : 1,
                    }}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => onToggle(r.personId, "absent")}
                    disabled={locked}
                    style={{
                      minHeight: 36,
                      padding: "0 var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--red)",
                      background: statuses[r.personId] === "absent" ? "var(--red)" : "var(--card-bg)",
                      color: statuses[r.personId] === "absent" ? "var(--cream)" : "var(--red)",
                      fontSize: "0.75rem",
                      cursor: locked ? "default" : "pointer",
                      opacity: locked ? 0.6 : 1,
                    }}
                  >
                    Absent
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!editMode &&
        (adding ? (
          <AddPersonForm
            activityInstanceId={activityInstanceId}
            role={role}
            onDone={() => {
              setAdding(false);
              onChanged();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{
              marginTop: "var(--space-2)",
              width: "100%",
              minHeight: "var(--tap-min)",
              background: "none",
              border: "1px dashed var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3)",
              fontSize: "0.8rem",
              color: "var(--warm)",
              cursor: "pointer",
            }}
          >
            + Add New {role === "participant" ? "Participant" : "Facilitator"}
          </button>
        ))}
    </section>
  );
}

type SearchResult = { id: string; name: string; preferredName: string | null; linkStatus: "linked" | "pending" };

function AddPersonForm({
  activityInstanceId,
  role,
  onDone,
  onCancel,
}: {
  activityInstanceId: string;
  role: "participant" | "facilitator";
  onDone: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const r = await searchPeople(value);
    setResults(r);
  }

  async function handleCreateNew() {
    if (!query.trim()) return;
    setBusy(true);
    await quickAddPerson(activityInstanceId, query.trim(), role);
    setBusy(false);
    onDone();
  }

  async function handlePick(personId: string) {
    setBusy(true);
    await enrollExistingPerson(activityInstanceId, personId, role);
    setBusy(false);
    onDone();
  }

  return (
    <div style={{ marginTop: "var(--space-2)", background: "var(--card-bg)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: "var(--space-3)" }}>
      <input
        autoFocus
        placeholder="Type a name…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", fontSize: 16, minHeight: "var(--tap-min)", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
      />
      <div style={{ marginTop: "var(--space-2)", display: "grid", gap: "var(--space-1)" }}>
        <button
          onClick={handleCreateNew}
          disabled={busy || !query.trim()}
          style={{
            textAlign: "left",
            minHeight: "var(--tap-min)",
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px dashed var(--gold)",
            background: "var(--cream2)",
            color: "var(--warm)",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          + Create new{query.trim() ? `: "${query.trim()}"` : "…"}
        </button>
        {results.map((r) => (
          <button
            key={r.id}
            onClick={() => handlePick(r.id)}
            disabled={busy}
            style={{
              textAlign: "left",
              minHeight: "var(--tap-min)",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {r.preferredName || r.name}
            {r.linkStatus === "pending" && <span style={{ color: "var(--muted)" }}> (not linked)</span>}
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        style={{ marginTop: "var(--space-2)", background: "none", border: "none", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer" }}
      >
        Cancel
      </button>
    </div>
  );
}
