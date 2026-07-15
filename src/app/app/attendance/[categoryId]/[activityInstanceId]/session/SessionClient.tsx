"use client";

import { useState, useTransition, useEffect, useRef } from "react";
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
  createHouseholdForRoster,
  searchContactForRoster,
  createContactPerson,
  saveHouseholdContact,
  updatePersonInfo,
  createEventDate,
  changeEnrollmentRole,
} from "./actions";
import { formatFullName } from "@/lib/formatName";
import { getPersonCompletenessLevel, type CompletenessLevel } from "@/lib/personCompleteness";
import { calculateAge } from "@/lib/category";
import { getRoleLabels } from "@/lib/activityRoleLabels";

type RosterRow = {
  personId: string;
  name: string;
  preferredName: string | null;
  linkStatus: "linked" | "pending";
  dob: string | null;
  mobile: string | null;
  householdId: string | null;
  householdName: string | null;
  householdContactPersonId: string | null;
  householdContactName: string | null;
  householdContactPreferredName: string | null;
  householdContactMobile: string | null;
  regoYear: number | null;
  role: "participant" | "facilitator" | "assistant";
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
  needsDateConfirmation,
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
  needsDateConfirmation: boolean;
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

  // Reclassifying a Facilitator/Assistant — a plain role column update, so
  // nothing about their attendance history moves or changes (see
  // changeEnrollmentRole in actions.ts). Refetches the roster afterwards
  // since Facilitators/Assistants are two separate derived lists below,
  // not something a single optimistic local update can move between.
  function moveRole(personId: string, role: "facilitator" | "assistant") {
    startTransition(() => {
      changeEnrollmentRole(activityInstanceId, personId, role).then(() => router.refresh());
    });
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
  const assistants = roster.filter((r) => r.role === "assistant" && visible(r)).sort(byDisplayName);
  // PSEC calls these Teachers/Co-Teachers, JYSEP calls them Animators/
  // Co-Animators, and Study Circles don't split the role at all — see
  // activityRoleLabels.ts.
  const roleLabels = getRoleLabels(categoryId);

  return (
    <>
      {pillSlot && createPortal(<LockStatusPill locked={locked} cancelled={cancelled} onToggle={toggleLocked} disabled={!canToggleLock} />, pillSlot)}

      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-4)" }}>
        {activityName}
      </h2>

      <DatePicker
        activityInstanceId={activityInstanceId}
        selectedDate={selectedDate}
        recentDates={recentDates}
        heldDates={heldDates}
        onPick={goToDate}
        awaitingConfirmation={needsDateConfirmation}
      />

      {needsDateConfirmation ? (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          This activity has no cadence, so there&rsquo;s no date to suggest — choose a date above to begin taking attendance.
        </p>
      ) : (
        <>
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
            title={roleLabels.facilitator}
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
            moveTo={roleLabels.showAssistants ? { role: "assistant", label: roleLabels.assistant } : undefined}
            onMove={moveRole}
          />
          {roleLabels.showAssistants && (
            <RosterSection
              title={roleLabels.assistant}
              rows={assistants}
              statuses={statuses}
              onToggle={toggle}
              activityInstanceId={activityInstanceId}
              role="assistant"
              onChanged={() => router.refresh()}
              editMode={editMode}
              activeByPersonId={activeByPersonId}
              onToggleActive={toggleActive}
              readOnly={readOnly}
              cancelled={cancelled}
              isAdmin={isAdmin}
              moveTo={{ role: "facilitator", label: roleLabels.facilitator }}
              onMove={moveRole}
            />
          )}

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
              {/* An admin-editable, no-checkbox state: the facilitator is
                  saying no session happened at all, distinct from marking
                  everyone absent. */}
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
                {cancelled ? "Cancelled" : "Cancel Class"}
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
        </>
      )}

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
  activityInstanceId,
  selectedDate,
  recentDates,
  heldDates,
  onPick,
  awaitingConfirmation,
}: {
  activityInstanceId: string;
  selectedDate: string;
  recentDates: string[];
  heldDates: string[];
  onPick: (date: string) => void;
  // Nothing's actually been chosen yet (a brand-new ad-hoc activity) —
  // selectedDate is just a guessed default, so don't show it as a pill like
  // it was deliberately picked.
  awaitingConfirmation: boolean;
}) {
  const [open, setOpen] = useState(false);
  // A real controlled value (not the perpetual value="" this had before),
  // and picking a date only updates local state — same as the Add Info
  // modal's working DOB field. Committing is a separate, explicit action
  // (the Add button), instead of onChange itself navigating and unmounting
  // this whole popover the instant a value changes.
  const [newEventDate, setNewEventDate] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleAddEventDate() {
    if (!newEventDate) return;
    setAddPending(true);
    setAddError(null);
    try {
      // "Add" should mean add — create the session now, not just navigate
      // to a date that only becomes a real event once someone's first
      // marked, otherwise reopening this picker right after wouldn't show
      // the date it just "added" as held.
      await createEventDate(activityInstanceId, newEventDate);
      onPick(newEventDate);
      setOpen(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add that date.");
    } finally {
      setAddPending(false);
    }
  }

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
  // Whatever date is actually being viewed/edited must always be visible
  // here, even when it's not one of the cadence-predicted quick picks (e.g.
  // an ad-hoc activity, which never has any) — otherwise there's no visual
  // sign of which date attendance is about to be marked against. Skipped
  // while awaitingConfirmation: selectedDate there is just a guess, not a
  // real pick, so it shouldn't look chosen.
  const pillDates = awaitingConfirmation || recentDates.includes(selectedDate) ? recentDates : [selectedDate, ...recentDates];

  return (
    <div style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "stretch", gap: "var(--space-2)" }}>
      {/* overscrollBehaviorX + touchAction stop a horizontal swipe here from
          chaining into the page's own vertical scroll — without them, a
          swipe that isn't perfectly horizontal reads as a visible wobble on
          mobile as the two scrolls fight each other. */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          overflowX: "auto",
          flex: 1,
          overscrollBehaviorX: "contain",
          touchAction: "pan-x",
        }}
      >
        {pillDates.map((d) => (
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
          style={{ ...pillStyle, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", whiteSpace: "nowrap" }}
        >
          Pick Date
        </button>
        {open &&
          createPortal(
            <>
              {/* Portaled to document.body (same as the lock-status pill
                  above) rather than rendered in place — this popover lives
                  inside <main>'s scrolling container, and position:fixed
                  nested inside a scrolling ancestor is unreliable on iOS
                  (already the reason AppLayout locks the whole shell to the
                  viewport instead): the backdrop was covering the page but
                  not the sticky header above it. Portaling to <body> makes
                  "fixed" mean the actual viewport, no ambiguity.
                  Centered overlay (same pattern as the Add Info/Merge
                  Confirm modals) instead of a dropdown anchored below the
                  button — an anchored popover's position is relative to the
                  visual viewport, which the native date-picker sheet resizes
                  on mobile, so the popover would visibly detach from the
                  button and appear to vanish mid-interaction.
                  No click-to-dismiss on the backdrop itself: tapping the
                  date input below opens iOS's own native picker UI, which
                  isn't part of this page's DOM/z-index stack — dismissing it
                  can replay a click at the same screen coordinates, and if
                  that lands on this backdrop it would close the whole
                  popover before a date could ever be picked. Closing only
                  happens via the explicit Close button or actually picking a
                  date. */}
              <div style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(0,0,0,0.65)" }} />
              <div
                style={{
                  position: "fixed",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 50,
                  width: "min(90vw, 220px)",
                  maxHeight: "70vh",
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
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 6,
                    borderTop: heldDates.length > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <span style={{ display: "block", fontSize: "0.7rem", color: "var(--muted)", marginBottom: 4 }}>Or add new event date</span>
                  {/* overflow:hidden here is a hard backstop: width:100% +
                      box-sizing:border-box + min-width:0 should already
                      constrain the input, but a native date control's
                      internal rendering has proven unreliable enough in this
                      exact spot that it's worth guaranteeing it can never
                      visually bleed past this wrapper regardless of why. */}
                  <div style={{ overflow: "hidden", width: "100%" }}>
                    <input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      style={{
                        display: "block",
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        // >= 16px (not the 0.8rem every other pill in this
                        // popover uses) — smaller makes iOS Safari auto-zoom
                        // on focus.
                        fontSize: 16,
                        textAlign: "left",
                        padding: "6px 8px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--card-bg)",
                        color: "var(--text)",
                      }}
                    />
                  </div>
                  <button
                    onClick={handleAddEventDate}
                    disabled={!newEventDate || addPending}
                    style={{
                      marginTop: 6,
                      width: "100%",
                      minHeight: 36,
                      padding: "0 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: "var(--deep)",
                      color: "var(--cream)",
                      fontSize: "0.8rem",
                      cursor: newEventDate && !addPending ? "pointer" : "default",
                      opacity: newEventDate && !addPending ? 1 : 0.6,
                    }}
                  >
                    {addPending ? "Adding…" : "Add"}
                  </button>
                  {addError && <p style={{ color: "var(--red)", fontSize: "0.7rem", marginTop: 4 }}>{addError}</p>}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    marginTop: 6,
                    padding: "6px 8px",
                    border: "none",
                    background: "none",
                    color: "var(--muted)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </>,
            document.body,
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
  moveTo,
  onMove,
}: {
  title: string;
  rows: RosterRow[];
  statuses: Record<string, Status>;
  onToggle: (personId: string, status: Status) => void;
  activityInstanceId: string;
  role: "participant" | "facilitator" | "assistant";
  onChanged: () => void;
  editMode: boolean;
  activeByPersonId: Record<string, boolean>;
  onToggleActive: (personId: string) => void;
  readOnly: boolean;
  cancelled: boolean;
  isAdmin: boolean;
  // Facilitator/Assistant sections only, and only for categories that split
  // the role at all (see activityRoleLabels.ts's showAssistants) — lets an
  // admin reclassify someone in editMode without losing their attendance
  // history (a plain role-column update, see changeEnrollmentRole).
  moveTo?: { role: "facilitator" | "assistant"; label: string };
  onMove?: (personId: string, role: "facilitator" | "assistant") => void;
}) {
  const [adding, setAdding] = useState(false);
  // These vocabularies are all regular plurals ("Teachers", "Co-Teachers",
  // "Participants", ...) — stripping a trailing "s" reliably singularizes
  // every label this app actually uses for "+ Add New ___".
  const singularTitle = title.replace(/s$/, "");

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
                <PersonInfoBadge
                  person={r}
                  onSaved={onChanged}
                  level={getPersonCompletenessLevel({
                    dob: r.dob,
                    mobile: r.mobile,
                    householdId: r.householdId,
                    householdContactPersonId: r.householdContactPersonId,
                    householdContactMobile: r.householdContactMobile,
                    regoYear: r.regoYear,
                  })}
                />
              </div>
              {editMode ? (
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  {moveTo && onMove && (
                    <button
                      onClick={() => onMove(r.personId, moveTo.role)}
                      title={`Move to ${moveTo.label}`}
                      style={{
                        minHeight: 36,
                        padding: "0 var(--space-3)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px dashed var(--gold)",
                        background: "none",
                        color: "var(--heading)",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      → {moveTo.label}
                    </button>
                  )}
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
                </div>
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
            + Add New {singularTitle}
          </button>
        ))}
    </section>
  );
}

type SearchResult = { id: string; name: string; preferredName: string | null; linkStatus: "linked" | "pending" };

// fontSize must be >= 16px — anything smaller makes iOS Safari auto-zoom the
// whole page on focus, and it doesn't reliably zoom back out on blur (the
// bug this was fixed for: fields, and the roster behind the modal, staying
// zoomed in after the keyboard closed).
const modalInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 16,
  minHeight: 40,
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
};

// Flags a field that's part of isPersonInfoComplete and still empty.
const missingBorderStyle: React.CSSProperties = { border: "1px solid var(--red)" };

// How long to wait after the last change before auto-saving.
const AUTOSAVE_DELAY_MS = 700;

// Every person gets this pill, opening the same modal either way — only the
// label changes, so it always reads as "here's this person's info" while
// still flagging when something required is actually missing.
function PersonInfoBadge({ person, onSaved, level }: { person: RosterRow; onSaved: () => void; level: CompletenessLevel }) {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(true)}
        title={level === "green" ? "Details complete" : level === "yellow" ? "Some details missing" : "No emergency contact on file"}
        style={{ flexShrink: 0, display: "flex", padding: 0, border: "none", background: "none", cursor: "pointer" }}
      >
        <FaceIcon level={level} />
      </button>
      {open && <AddInfoModal person={person} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </span>
  );
}

// Green/yellow/red carries the actual meaning (see personCompleteness.ts for
// what each level requires) — the mouth shape is just a redundant visual
// cue on top of color, not the primary signal.
function FaceIcon({ level }: { level: CompletenessLevel }) {
  const color = level === "green" ? "var(--green)" : level === "yellow" ? "var(--yellow)" : "var(--red)";
  const mouthPath = level === "green" ? "M8 14.5 Q12 18 16 14.5" : level === "yellow" ? "M8 15.5 L16 15.5" : "M8 17 Q12 13 16 17";
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="8.5" cy="10" r="1.1" fill={color} stroke="none" />
      <circle cx="15.5" cy="10" r="1.1" fill={color} stroke="none" />
      <path d={mouthPath} />
    </svg>
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
  const [preferredName, setPreferredName] = useState(person.preferredName ?? "");
  const [personalMobile, setPersonalMobile] = useState(person.mobile ?? "");
  const [dob, setDob] = useState(person.dob ?? "");
  // Recomputed live off whatever DOB is currently typed, not just the
  // person's saved one — editing DOB should immediately show/hide the
  // personal-mobile field and the rego block rather than waiting for Save.
  const age = dob ? calculateAge(dob) : null;
  const showPersonalMobile = age !== null && age >= 12;
  // Unknown DOB defaults to the stricter under-15 bracket, same reasoning
  // as the face-icon completeness level.
  const isUnder15 = age === null || age < 15;
  const [householdId, setHouseholdId] = useState(person.householdId);
  const [householdQuery, setHouseholdQuery] = useState(person.householdName ?? "");
  const [householdResults, setHouseholdResults] = useState<{ id: string; name: string }[]>([]);
  // Contact/Mobile belong to the household, not this person — prefilled from
  // whatever contact the person's current household already has, if any.
  const [contactPersonId, setContactPersonId] = useState(person.householdContactPersonId);
  const [contactQuery, setContactQuery] = useState(person.householdContactPreferredName || person.householdContactName || "");
  const [contactResults, setContactResults] = useState<{ id: string; name: string; preferredName: string | null; mobile: string | null }[]>([]);
  const [contactMobile, setContactMobile] = useState(person.householdContactMobile ?? "");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Frozen snapshot of every field as this modal opened — used both to diff
  // "did this actually change" for auto-save, and by Cancel to revert.
  const originalRef = useRef(person);
  // A newly selected/created household's real contact isn't known
  // client-side — this tracks the right baseline to diff the Contact
  // fields against once the household has changed from the person's
  // original one (see persist() below), same reasoning as Find Person's
  // PersonEditForm.
  const householdBaselineRef = useRef({
    householdId: person.householdId,
    contactPersonId: person.householdContactPersonId,
    contactMobile: person.householdContactMobile ?? "",
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleHouseholdSearch(value: string) {
    setHouseholdQuery(value);
    setHouseholdId(null);
    setHouseholdResults(await searchHouseholdsForRoster(value));
  }

  async function handleCreateHousehold() {
    const trimmed = householdQuery.trim();
    if (!trimmed) return;
    try {
      const created = await createHouseholdForRoster(trimmed);
      setHouseholdId(created.id);
      setHouseholdQuery(created.name);
      setHouseholdResults([]);
      householdBaselineRef.current = { householdId: created.id, contactPersonId: null, contactMobile: "" };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that household.");
    }
  }

  async function handleContactSearch(value: string) {
    setContactQuery(value);
    setContactPersonId(null);
    setContactResults(await searchContactForRoster(value));
  }

  function selectContact(p: { id: string; name: string; preferredName: string | null; mobile: string | null }) {
    setContactPersonId(p.id);
    setContactQuery(p.preferredName || p.name);
    setContactResults([]);
    setContactMobile(p.mobile ?? "");
  }

  async function handleCreateContact() {
    const trimmed = contactQuery.trim();
    if (!trimmed) return;
    try {
      const created = await createContactPerson(trimmed);
      setContactPersonId(created.id);
      setContactQuery(created.preferredName || created.name);
      setContactResults([]);
      setContactMobile(""); // a brand-new person has no mobile yet
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that contact.");
    }
  }

  // The auto-save itself — diffs current state against the frozen original
  // and only sends what actually changed.
  async function persist() {
    setSaving(true);
    setError(null);
    try {
      let finalHouseholdId = householdId;
      // No household yet, but a contact was picked anyway — a contact
      // doesn't require a household to already exist, so create a bare one
      // now (named after this person) purely so the contact has somewhere
      // to attach to. Can be renamed/merged properly later in Edit
      // Households.
      if (!finalHouseholdId && contactPersonId) {
        const created = await createHouseholdForRoster(`${name.trim() || person.name} household`);
        finalHouseholdId = created.id;
        setHouseholdId(created.id);
        setHouseholdQuery(created.name);
        householdBaselineRef.current = { householdId: created.id, contactPersonId: null, contactMobile: "" };
      }

      const patch: Partial<{ name: string; preferredName: string | null; mobile: string | null; dob: string | null; householdId: string | null }> = {};
      if (name.trim() && name !== originalRef.current.name) patch.name = name;
      if (preferredName !== (originalRef.current.preferredName ?? "")) patch.preferredName = preferredName.trim() || null;
      if (dob !== (originalRef.current.dob ?? "")) patch.dob = dob || null;
      if (finalHouseholdId !== originalRef.current.householdId) patch.householdId = finalHouseholdId;
      // Only ever sent when the field's actually shown — nothing to save
      // for a field the admin never had a chance to see or edit.
      if (showPersonalMobile && personalMobile !== (originalRef.current.mobile ?? "")) patch.mobile = personalMobile.trim() || null;

      const tasks: Promise<unknown>[] = [];
      if (Object.keys(patch).length > 0) tasks.push(updatePersonInfo(person.personId, patch));

      const onOriginalHousehold = finalHouseholdId === originalRef.current.householdId;
      const contactIdBaseline = onOriginalHousehold ? originalRef.current.householdContactPersonId : householdBaselineRef.current.contactPersonId;
      const contactMobileBaseline = onOriginalHousehold ? (originalRef.current.householdContactMobile ?? "") : householdBaselineRef.current.contactMobile;
      if (finalHouseholdId && (contactPersonId !== contactIdBaseline || contactMobile !== contactMobileBaseline)) {
        tasks.push(saveHouseholdContact(finalHouseholdId, contactPersonId, contactMobile || null));
      }
      if (tasks.length === 0) return;
      await Promise.all(tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    saveTimer.current = setTimeout(() => {
      persist();
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, preferredName, personalMobile, dob, householdId, contactPersonId, contactMobile]);

  // The relabeled former Save button — auto-save already did the work, this
  // just flushes anything still mid-debounce, refreshes the roster, and closes.
  async function handleFinish() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await persist();
    onSaved();
    onClose();
  }

  // Undoes whatever auto-save already persisted for this person and their
  // *original* household this session, then closes. A household auto-
  // created along the way (see persist() above) is left in place rather
  // than deleted — same reasoning as Find Person's PersonEditForm: it's a
  // real, independent household record, not something scoped to undo.
  async function handleCancel() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setCancelling(true);
    try {
      await updatePersonInfo(person.personId, {
        name: originalRef.current.name,
        preferredName: originalRef.current.preferredName ?? null,
        mobile: originalRef.current.mobile ?? null,
        dob: originalRef.current.dob,
        householdId: originalRef.current.householdId,
      });
      if (originalRef.current.householdId) {
        await saveHouseholdContact(originalRef.current.householdId, originalRef.current.householdContactPersonId, originalRef.current.householdContactMobile ?? null);
      }
      onSaved();
    } catch {
      // Best-effort revert — still close either way.
    } finally {
      setCancelling(false);
    }
    onClose();
  }

  return (
    <>
      {/* Tapping outside closes without discarding — auto-save already ran,
          so this behaves like the "Auto-Save" button, not Cancel. */}
      <div onClick={handleFinish} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.65)" }} />
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
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "var(--heading)" }}>Add Info</h3>
          {isUnder15 && (
            <span style={{ fontSize: "0.8rem", color: "var(--yellow)", whiteSpace: "nowrap" }}>
              {person.regoYear ? `Registration: ${person.regoYear}` : "No Registration Form"}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <ModalField label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} style={modalInputStyle} />
          </ModalField>
          <ModalField label="AKA">
            <input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} style={modalInputStyle} />
          </ModalField>
          {/* 12+ only — below that, only a household contact's mobile makes
              sense (see the Contact's Mobile field further down). Driven by
              the DOB field below, live as it's edited. */}
          {showPersonalMobile && (
            <ModalField label="Mobile">
              <input
                type="tel"
                value={personalMobile}
                onChange={(e) => setPersonalMobile(e.target.value)}
                style={modalInputStyle}
              />
            </ModalField>
          )}
          <ModalField label="DOB">
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              // textAlign alone doesn't reach a date input's actual text on
              // iOS Safari (globals.css overrides the internal pseudo-element
              // that does) — minWidth:0 stops it rendering wider than every
              // other field here, the same grid/flex min-width:auto overflow
              // as elsewhere.
              style={{ ...modalInputStyle, textAlign: "left", minWidth: 0, ...(!dob ? missingBorderStyle : {}) }}
            />
          </ModalField>
          {/* Single divider — Personal info above, Household info below. */}
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0, width: "100%" }} />
          <ModalField label="Household">
            <input
              placeholder="Search household…"
              value={householdQuery}
              onChange={(e) => handleHouseholdSearch(e.target.value)}
              style={{ ...modalInputStyle, ...(!householdId ? missingBorderStyle : {}) }}
            />
            {householdQuery.trim() && householdId === null && (
              <button
                onClick={handleCreateHousehold}
                style={{
                  marginTop: 4,
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  border: "1px dashed var(--gold)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--cream2)",
                  color: "var(--warm)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                + Create new household: &ldquo;{householdQuery.trim()}&rdquo;
              </button>
            )}
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
          <ModalField label="Contact">
            <input
              placeholder="Search contact…"
              value={contactQuery}
              onChange={(e) => handleContactSearch(e.target.value)}
              style={{ ...modalInputStyle, ...(!contactPersonId ? missingBorderStyle : {}) }}
            />
            {contactQuery.trim() && contactPersonId === null && (
              <button
                onClick={handleCreateContact}
                style={{
                  marginTop: 4,
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  border: "1px dashed var(--gold)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--cream2)",
                  color: "var(--warm)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                + Create new contact: &ldquo;{contactQuery.trim()}&rdquo;
              </button>
            )}
            {contactResults.length > 0 && (
              <div style={{ marginTop: 4, display: "grid", gap: 2, maxHeight: 120, overflowY: "auto" }}>
                {contactResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectContact(p)}
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
                    {p.preferredName ? `${p.name} (${p.preferredName})` : p.name}
                  </button>
                ))}
              </div>
            )}
          </ModalField>
          <ModalField label="Contact's Mobile">
            <input
              type="tel"
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
              disabled={!contactPersonId}
              placeholder={contactPersonId ? undefined : "Pick a contact first"}
              style={{ ...modalInputStyle, opacity: contactPersonId ? 1 : 0.6, ...(!contactMobile ? missingBorderStyle : {}) }}
            />
          </ModalField>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: "var(--space-4)" }}>
          <button
            onClick={handleFinish}
            disabled={saving || cancelling}
            style={{ minHeight: 36, padding: "0 20px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--deep)", color: "var(--cream)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {saving ? "Saving…" : "Auto-Save"}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving || cancelling}
            style={{ minHeight: 36, padding: "0 20px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {cancelling ? "Undoing…" : "Cancel"}
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
  role: "participant" | "facilitator" | "assistant";
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
