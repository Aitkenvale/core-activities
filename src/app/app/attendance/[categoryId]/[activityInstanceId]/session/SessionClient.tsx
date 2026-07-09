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
  getCancelledStatus,
  setCancelledStatus,
  searchHouseholdsForRoster,
  updatePersonInfo,
} from "./actions";
import { formatFullName } from "@/lib/formatName";
import { isPersonInfoComplete } from "@/lib/personCompleteness";

type RosterRow = {
  personId: string;
  name: string;
  preferredName: string | null;
  linkStatus: "linked" | "pending";
  dob: string | null;
  householdId: string | null;
  householdName: string | null;
  regoYear: number | null;
  role: "participant" | "facilitator";
  active: boolean;
};

type Status = "present" | "absent" | undefined;

// editWindowMonths is passed down from the server (Settings > Security,
// src/lib/settings.ts) — this is only a UI hint (disabling controls so
// nothing looks saved when the server would reject it); the actual rule is
// enforced server-side regardless.
function isOutsideEditWindow(sessionDate: string, editWindowMonths: number): boolean {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - editWindowMonths);
  return sessionDate < cutoff.toISOString().slice(0, 10);
}

export function SessionClient({
  categoryId,
  activityInstanceId,
  activityName,
  selectedDate,
  recentDates,
  heldDates,
  roster,
  statusByPersonId,
  isAdmin,
  editWindowMonths,
}: {
  categoryId: string;
  activityInstanceId: string;
  activityName: string;
  selectedDate: string;
  recentDates: string[];
  heldDates: string[];
  roster: RosterRow[];
  statusByPersonId: Record<string, Status>;
  isAdmin: boolean;
  editWindowMonths: number;
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, Status>>(statusByPersonId);
  const [activeByPersonId, setActiveByPersonId] = useState<Record<string, boolean>>(
    Object.fromEntries(roster.map((r) => [r.personId, r.active])),
  );
  const [editMode, setEditMode] = useState(false);
  const [locked, setLocked] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pillSlot, setPillSlot] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Facilitators can't edit sessions past the window at all, regardless of
  // the locked flag (locked can still be toggled off by an admin later).
  // Cancelled also makes it read-only — there's no attendance to take for a
  // session that never happened.
  const readOnly = locked || cancelled || (!isAdmin && isOutsideEditWindow(selectedDate, editWindowMonths));
  const canToggleLock = isAdmin || !isOutsideEditWindow(selectedDate, editWindowMonths);

  // Switching the date pill, or a router.refresh() after enrolling/merging
  // someone, re-renders this component with new props (same component
  // instance, not a remount) — the useState initializers above only apply on
  // first mount. Without this, a newly-merged person's enrollment (correctly
  // active in the database) was invisible client-side: activeByPersonId had
  // no entry at all for them (never in the roster the page first loaded
  // with), and `undefined` reads as falsy in the visible() check below, so
  // they silently vanished from the roster despite their data being intact.
  useEffect(() => {
    setStatuses(statusByPersonId);
    setActiveByPersonId(Object.fromEntries(roster.map((r) => [r.personId, r.active])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, roster, statusByPersonId]);

  useEffect(() => {
    getLockStatus(activityInstanceId, selectedDate).then(setLocked);
    getCancelledStatus(activityInstanceId, selectedDate).then(setCancelled);
  }, [activityInstanceId, selectedDate]);

  useEffect(() => {
    setPillSlot(document.getElementById("lock-status-slot"));
  }, []);

  function goToDate(date: string) {
    router.push(`/app/attendance/${categoryId}/${activityInstanceId}/session?date=${date}`);
  }

  function toggle(personId: string, next: Status) {
    if (readOnly) return;
    setError(null);
    const previous = statuses[personId];
    setStatuses((s) => ({ ...s, [personId]: next }));
    if (next) {
      startTransition(() => {
        setAttendance(activityInstanceId, selectedDate, personId, next).catch((e) => {
          setStatuses((s) => ({ ...s, [personId]: previous }));
          setError(e instanceof Error ? e.message : "Couldn't save that change.");
        });
      });
    }
  }

  function toggleActive(personId: string) {
    const next = !activeByPersonId[personId];
    setActiveByPersonId((s) => ({ ...s, [personId]: next }));
    startTransition(() => setEnrollmentActive(activityInstanceId, personId, next));
  }

  function toggleLocked() {
    if (!canToggleLock) return;
    setError(null);
    const next = !locked;
    setLocked(next);
    startTransition(() => {
      setLockStatus(activityInstanceId, selectedDate, next).catch((e) => {
        setLocked(!next);
        setError(e instanceof Error ? e.message : "Couldn't save that change.");
      });
    });
  }

  function toggleCancelled() {
    if (!canToggleLock) return;
    setError(null);
    const next = !cancelled;
    setCancelled(next);
    startTransition(() => {
      setCancelledStatus(activityInstanceId, selectedDate, next).catch((e) => {
        setCancelled(!next);
        setError(e instanceof Error ? e.message : "Couldn't save that change.");
      });
    });
  }

  const visible = (r: RosterRow) => editMode || activeByPersonId[r.personId];
  const byDisplayName = (a: RosterRow, b: RosterRow) => (a.preferredName || a.name).localeCompare(b.preferredName || b.name);
  const participants = roster.filter((r) => r.role === "participant" && visible(r)).sort(byDisplayName);
  const facilitators = roster.filter((r) => r.role === "facilitator" && visible(r)).sort(byDisplayName);

  return (
    <>
      {pillSlot && createPortal(<LockStatusPill locked={locked} cancelled={cancelled} onToggle={toggleLocked} disabled={!canToggleLock} />, pillSlot)}

      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 4px" }}>
        {activityName}
      </h2>

      <DatePicker selectedDate={selectedDate} recentDates={recentDates} heldDates={heldDates} onPick={goToDate} />

      {!isAdmin && !canToggleLock && (
        <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginBottom: "var(--space-4)" }}>
          This session is more than {editWindowMonths} months old — only an admin can make changes.
        </p>
      )}

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
        readOnly={readOnly}
        cancelled={cancelled}
        isAdmin={isAdmin}
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
        readOnly={readOnly}
        cancelled={cancelled}
        isAdmin={isAdmin}
      />

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <button
            onClick={toggleLocked}
            disabled={locked || !canToggleLock || cancelled}
            style={{
              minHeight: "var(--tap-min)",
              padding: "0 16px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--green)",
              background: locked ? "var(--border)" : "var(--card-bg)",
              color: locked ? "var(--muted)" : "var(--green)",
              fontSize: "0.85rem",
              cursor: locked || !canToggleLock || cancelled ? "default" : "pointer",
              opacity: canToggleLock && !cancelled ? 1 : 0.6,
              whiteSpace: "nowrap",
            }}
          >
            {locked ? "Confirmed" : "Confirm"}
          </button>
          {/* An admin-editable, no-checkbox state: the facilitator is saying
              no session happened at all, distinct from marking everyone
              absent. */}
          <button
            onClick={toggleCancelled}
            disabled={!canToggleLock}
            style={{
              minHeight: "var(--tap-min)",
              padding: "0 16px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--red)",
              background: cancelled ? "var(--red)" : "var(--card-bg)",
              color: cancelled ? "var(--cream)" : "var(--red)",
              fontSize: "0.85rem",
              cursor: !canToggleLock ? "default" : "pointer",
              opacity: canToggleLock ? 1 : 0.6,
              whiteSpace: "nowrap",
            }}
          >
            {cancelled ? "Cancelled" : "Class Cancelled"}
          </button>
        </div>
        <button
          onClick={() => setEditMode((v) => !v)}
          style={{
            minHeight: "var(--tap-min)",
            padding: "0 16px",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border)",
            background: editMode ? "var(--deep)" : "var(--card-bg)",
            color: editMode ? "var(--cream)" : "var(--text)",
            fontSize: "0.85rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {editMode ? "Done" : "Edit"}
        </button>
      </div>

      {pending && <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 12 }}>Saving…</p>}
      {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 12 }}>{error}</p>}
    </>
  );
}

function LockStatusPill({
  locked,
  cancelled,
  onToggle,
  disabled,
}: {
  locked: boolean;
  cancelled: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const isDisabled = disabled || cancelled;
  return (
    <button
      onClick={onToggle}
      disabled={isDisabled}
      style={{
        padding: "6px 14px",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${cancelled ? "var(--muted)" : locked ? "var(--red)" : "var(--green)"}`,
        background: cancelled ? "var(--border)" : locked ? "var(--red)" : "var(--card-bg)",
        color: cancelled ? "var(--muted)" : locked ? "var(--cream)" : "var(--green)",
        fontSize: "0.7rem",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: isDisabled ? "default" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {cancelled ? "Cancelled" : locked ? "Confirmed" : "Unconfirmed"}
    </button>
  );
}

function DatePicker({
  selectedDate,
  recentDates,
  heldDates,
  onPick,
}: {
  selectedDate: string;
  recentDates: string[];
  heldDates: string[];
  onPick: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
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
      {/* Lists dates the activity was actually held (a real attendance_events
          row), not a native date-picker guessing game — a native <input
          type="date"> here previously relied on an invisible-input-under-
          a-decoy-label trick that turned out to be fragile and broke. */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ ...pillStyle, border: "1px dashed var(--gold)", background: "var(--cream2)", color: "var(--warm)", whiteSpace: "nowrap" }}
        >
          Pick Date
        </button>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 45 }} />
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                zIndex: 50,
                width: 180,
                maxHeight: 240,
                overflowY: "auto",
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-elevated)",
                padding: "var(--space-2)",
                display: "grid",
                gap: 2,
              }}
            >
              {heldDates.length === 0 && (
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", padding: "4px 8px", margin: 0 }}>No sessions recorded recently.</p>
              )}
              {heldDates.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    onPick(d);
                    setOpen(false);
                  }}
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: d === selectedDate ? "var(--deep)" : "var(--card-bg)",
                    color: d === selectedDate ? "var(--cream)" : "var(--text)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  {formatShort(d)}
                </button>
              ))}
              {/* Ad-hoc activities never have quick-pick pills (no cadence
                  to suggest a date from), and this list is only ever
                  already-held dates — this is the only way to reach a
                  genuinely new date otherwise. */}
              <label
                style={{
                  display: "block",
                  marginTop: 4,
                  paddingTop: 6,
                  borderTop: heldDates.length > 0 ? "1px solid var(--border)" : undefined,
                  fontSize: "0.7rem",
                  color: "var(--muted)",
                }}
              >
                Or choose another date
                <input
                  type="date"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onPick(e.target.value);
                    setOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    fontSize: "0.8rem",
                    padding: "6px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--card-bg)",
                    color: "var(--text)",
                  }}
                />
              </label>
            </div>
          </>
        )}
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
  readOnly,
  cancelled,
  isAdmin,
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
  readOnly: boolean;
  cancelled: boolean;
  isAdmin: boolean;
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
              {/* The "Add Info" badge is a sibling, not nested inside the
                  name span — that span's overflow:hidden (for the ellipsis)
                  would otherwise clip the badge's popover. */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: "0.9rem", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.preferredName || r.name}
                </span>
                {(r.linkStatus === "pending" || !isPersonInfoComplete(r.dob, r.householdId)) && (
                  <PersonInfoBadge person={r} onSaved={onChanged} />
                )}
              </div>
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
                    disabled={readOnly}
                    style={{
                      minHeight: 36,
                      padding: "0 var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${cancelled ? "var(--border)" : "var(--green)"}`,
                      background: cancelled ? "var(--border)" : statuses[r.personId] === "present" ? "var(--green)" : "var(--card-bg)",
                      color: cancelled ? "var(--muted)" : statuses[r.personId] === "present" ? "var(--cream)" : "var(--green)",
                      fontSize: "0.75rem",
                      cursor: readOnly ? "default" : "pointer",
                      opacity: readOnly && !cancelled ? 0.6 : 1,
                    }}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => onToggle(r.personId, "absent")}
                    disabled={readOnly}
                    style={{
                      minHeight: 36,
                      padding: "0 var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${cancelled ? "var(--border)" : "var(--red)"}`,
                      background: cancelled ? "var(--border)" : statuses[r.personId] === "absent" ? "var(--red)" : "var(--card-bg)",
                      color: cancelled ? "var(--muted)" : statuses[r.personId] === "absent" ? "var(--cream)" : "var(--red)",
                      fontSize: "0.75rem",
                      cursor: readOnly ? "default" : "pointer",
                      opacity: readOnly && !cancelled ? 0.6 : 1,
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

const badgeStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: "0.65rem",
  color: "var(--warm)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "1px 6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "0.85rem",
  minHeight: 36,
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
};

// Flags a person who's either still pending reconciliation or missing
// required info (DOB, household) — "Add Info" replaces the old "Not
// Linked" wording, since a quick-added person is already a real People row
// now (there's no separate spreadsheet to "link" to); what's actually
// missing is the info itself.
function PersonInfoBadge({ person, onSaved }: { person: RosterRow; onSaved: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ position: "relative" }}>
      <button onClick={() => setOpen(true)} style={{ ...badgeStyle, background: "none", cursor: "pointer" }}>
        Add Info
      </button>
      {open && <AddInfoModal person={person} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </span>
  );
}

function AddInfoModal({
  person,
  onClose,
  onSaved,
}: {
  person: RosterRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [dob, setDob] = useState(person.dob ?? "");
  const [regoYear, setRegoYear] = useState(person.regoYear !== null ? String(person.regoYear) : "");
  const [householdId, setHouseholdId] = useState(person.householdId);
  const [householdQuery, setHouseholdQuery] = useState(person.householdName ?? "");
  const [householdResults, setHouseholdResults] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleHouseholdSearch(value: string) {
    setHouseholdQuery(value);
    setHouseholdId(null);
    setHouseholdResults(await searchHouseholdsForRoster(value));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updatePersonInfo(person.personId, {
        name,
        dob: dob || null,
        householdId,
        regoYear: regoYear.trim() ? parseInt(regoYear, 10) : null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.4)" }} />
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 91,
          width: "min(90vw, 340px)",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-5)",
        }}
      >
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "var(--heading)", marginBottom: "var(--space-4)" }}>
          Add Info
        </h3>

        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <ModalField label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} style={modalInputStyle} />
          </ModalField>
          <ModalField label="DOB">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={{ ...modalInputStyle, fontSize: "0.8rem" }} />
          </ModalField>
          <ModalField label="Household">
            <input
              placeholder="Search household…"
              value={householdQuery}
              onChange={(e) => handleHouseholdSearch(e.target.value)}
              style={modalInputStyle}
            />
            {householdResults.length > 0 && (
              <div style={{ marginTop: 4, display: "grid", gap: 2, maxHeight: 120, overflowY: "auto" }}>
                {householdResults.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setHouseholdId(h.id);
                      setHouseholdQuery(h.name);
                      setHouseholdResults([]);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "4px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--card-bg)",
                      color: "var(--text)",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
          </ModalField>
          <ModalField label="Rego Year">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={regoYear}
              onChange={(e) => setRegoYear(e.target.value.replace(/\D/g, ""))}
              style={modalInputStyle}
            />
          </ModalField>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: "var(--space-4)" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ minHeight: 36, padding: "0 20px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--deep)", color: "var(--cream)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onClose}
            style={{ minHeight: 36, padding: "0 20px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
        {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 8 }}>{error}</p>}
      </div>
    </>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
      {children}
    </label>
  );
}

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
              color: "var(--text)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {formatFullName(r.name, r.preferredName)}
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
