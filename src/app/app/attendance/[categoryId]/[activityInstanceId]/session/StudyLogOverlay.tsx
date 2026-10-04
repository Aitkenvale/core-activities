"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/CloseButton";
import {
  STUDY_SECTIONS,
  nextStudyStatus,
  studyCellKey,
  studyTrackFor,
  type StoredStudyStatus,
  type StudyRestoreBox,
  type StudyStatus,
  type StudyTrack,
  type StudyTrackId,
} from "@/lib/studyTracks";
import { StudyLogGrid, studyGridWidth, studySwatchStyle, type StudyParticipant } from "./StudyLogGrid";

// statusDate is the hidden day the box reached its state: no screen shows it,
// but Cancel needs it to put a box back exactly as it was.
type ProgressRow = { personId: string; item: number; unit: number; status: StoredStudyStatus; statusDate: string | null };

// One map of box states per section: a box's key (person, item, unit) is only
// unique within its own section — Ruhi's Book 1 unit 1 and Branch 1 share one.
type ProgressByTrack = Record<string, Record<string, StudyStatus>>;
const NO_PROGRESS: Record<string, StudyStatus> = {};

// A box as this screen found it when its section was first opened — what Cancel
// puts back, and what the check on the way out compares against. A box with no
// entry had no row.
type Opened = { status: StudyStatus; date: string | null };
const NOT_STUDIED: Opened = { status: "none", date: null };

// Where a box stands with the server. A box has at most one save in flight;
// taps that land meanwhile just move `desired`, and one follow-up request
// sends the final state once the first finishes — so rapid taps can't reach
// the database out of order, and `server` is always what it last confirmed
// (the value a failed save falls back to).
type CellSync = {
  inFlight: boolean;
  desired: StudyStatus;
  server: StudyStatus;
  // Which box this is and what to call it ("Ana, Book 1 Unit 2"), for putting
  // it back and for saying which ones were set back.
  trackId: StudyTrackId;
  personId: string;
  item: number;
  unit: number;
  what: string;
  // Whether anything has been sent to the server for it — if so, the server's
  // copy (its date, too) may no longer be how it was found.
  sent: boolean;
};

// How long Cancel waits for saves still on their way before giving up.
const IDLE_TIMEOUT_MS = 10_000;

function LegendItem({ status, text, tone }: { status: StudyStatus; text: string; tone: StudyTrack["legendTone"] }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, boxSizing: "border-box", ...studySwatchStyle(status, tone) }} />
      {text}
    </span>
  );
}

// The screen's title, which is also where you choose which section of study
// history to edit for the participants: any of them, whatever kind of activity
// this is. A menu of our own rather than a native <select>, so it looks like
// the heading it replaces and matches the app in both themes.
function SectionPicker({ value, onChange, disabled }: { value: StudyTrackId; onChange: (id: StudyTrackId) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = STUDY_SECTIONS.find((s) => s.id === value) ?? STUDY_SECTIONS[0];

  // A tap anywhere else, or Escape, closes the menu.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="study-picker">
      <button type="button" className="study-picker-button" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen((v) => !v)}>
        <span>{current.title}</span>
        <svg className="study-picker-triangle" aria-hidden width="11" height="7" viewBox="0 0 11 7">
          <path d="M0 0h11L5.5 7z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label="Section of study history to edit" className="study-picker-menu">
          {STUDY_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="menuitemradio"
              aria-checked={section.id === value}
              className="study-picker-item"
              onClick={() => {
                setOpen(false);
                onChange(section.id);
              }}
            >
              {section.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// One section of study history (Children's Grades, Junior Youth Texts, the Ruhi
// main sequence or branches, Discourse courses) for an activity's participants
// — current and former — as a whole-screen overlay (same shape as Add Info and
// Search). It opens on the section that belongs to the activity's category, and
// the title is a menu for switching to any other. Reading and writing are
// passed in rather than imported so the screen doesn't care where its data
// comes from — the Attendance page hands it the real server actions.
//
// Taps are saved as they are made. Close keeps them; Cancel puts everything
// done since the screen opened back as it was.
export function StudyLogOverlay({
  initialSection,
  participants,
  onClose,
  loadProgress,
  saveStatus,
  restoreStatuses,
}: {
  initialSection: StudyTrackId;
  participants: StudyParticipant[];
  onClose: () => void;
  loadProgress: (trackId: StudyTrackId, personIds: string[]) => Promise<ProgressRow[]>;
  saveStatus: (trackId: StudyTrackId, personId: string, item: number, unit: number, status: StudyStatus) => Promise<unknown>;
  // Puts boxes back exactly as they were, date and all — all or nothing.
  restoreStatuses: (boxes: StudyRestoreBox[]) => Promise<unknown>;
}) {
  const [sectionId, setSectionId] = useState<StudyTrackId>(initialSection);
  const [progress, setProgress] = useState<ProgressByTrack>({});
  // The sections whose boxes have arrived — a section is fetched the first time it is shown.
  const [loadedIds, setLoadedIds] = useState<StudyTrackId[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Putting boxes back: taps and the buttons wait until it's done.
  const [busy, setBusy] = useState(false);

  // The latest maps, readable synchronously — a tap needs "what is this box
  // showing right now" even when two taps land before React re-renders.
  const progressRef = useRef<ProgressByTrack>({});
  const syncRef = useRef(new Map<string, CellSync>());
  const openedRef = useRef<Record<string, Record<string, Opened>>>({});
  const loadingRef = useRef(new Set<StudyTrackId>());
  const busyRef = useRef(false);
  // How many saves are on their way, and who is waiting for that to reach none.
  const inFlightRef = useRef(0);
  const idleWaitersRef = useRef<Array<() => void>>([]);

  const setCell = useCallback((trackId: StudyTrackId, key: string, status: StudyStatus) => {
    const cells = { ...progressRef.current[trackId] };
    if (status === "none") delete cells[key];
    else cells[key] = status;
    // Only the edited section's map is replaced, so the others keep the props
    // they had.
    const next = { ...progressRef.current, [trackId]: cells };
    progressRef.current = next;
    setProgress(next);
  }, []);

  const flush = useCallback(
    (sync: CellSync) => {
      if (sync.inFlight || sync.desired === sync.server) return;
      sync.inFlight = true;
      sync.sent = true;
      inFlightRef.current += 1;
      const sending = sync.desired;
      saveStatus(sync.trackId, sync.personId, sync.item, sync.unit, sending)
        .then(() => {
          sync.server = sending;
        })
        .catch(() => {
          // Whatever was queued behind it is dropped too — back to what
          // the database actually has.
          sync.desired = sync.server;
          setCell(sync.trackId, studyCellKey(sync.personId, sync.item, sync.unit), sync.server);
          setSaveError("Couldn't save that change — it's been put back.");
        })
        .finally(() => {
          sync.inFlight = false;
          inFlightRef.current -= 1;
          flush(sync);
          if (inFlightRef.current === 0) for (const resolve of idleWaitersRef.current.splice(0)) resolve();
        });
    },
    [saveStatus, setCell],
  );

  // Resolves once no save is on its way; rejects if that takes too long.
  const whenIdle = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        if (inFlightRef.current === 0) return resolve();
        const timer = setTimeout(() => reject(new Error("Still saving")), IDLE_TIMEOUT_MS);
        idleWaitersRef.current.push(() => {
          clearTimeout(timer);
          resolve();
        });
      }),
    [],
  );

  const cycle = useCallback(
    (trackId: StudyTrackId, personId: string, item: number, unit: number, what: string) => {
      if (busyRef.current) return;
      const key = studyCellKey(personId, item, unit);
      const syncKey = `${trackId}|${key}`;
      let sync = syncRef.current.get(syncKey);
      if (!sync) {
        const current = progressRef.current[trackId]?.[key] ?? "none";
        sync = { inFlight: false, desired: current, server: current, trackId, personId, item, unit, what, sent: false };
        syncRef.current.set(syncKey, sync);
      }
      // No question is asked, however far a box is taken (a completed one back to
      // not studied, say): Cancel is the way back.
      sync.desired = nextStudyStatus(sync.desired);
      setSaveError(null);
      setCell(trackId, key, sync.desired);
      flush(sync);
    },
    [flush, setCell],
  );

  // Fetches a section's boxes, and remembers how they were found. Only one
  // section is on screen at a time, so there is one tap handler, the same
  // between renders, and the boxes a tap didn't touch aren't redrawn.
  const load = useCallback(
    (trackId: StudyTrackId) => {
      if (loadingRef.current.has(trackId)) return;
      loadingRef.current.add(trackId);
      loadProgress(
        trackId,
        participants.map((p) => p.personId),
      )
        .then((rows) => {
          const map: Record<string, StudyStatus> = {};
          const was: Record<string, Opened> = {};
          for (const r of rows) {
            const key = studyCellKey(r.personId, r.item, r.unit);
            map[key] = r.status;
            was[key] = { status: r.status, date: r.statusDate };
          }
          progressRef.current = { ...progressRef.current, [trackId]: map };
          openedRef.current = { ...openedRef.current, [trackId]: was };
          setProgress(progressRef.current);
          setLoadedIds((ids) => (ids.includes(trackId) ? ids : [...ids, trackId]));
        })
        .catch(() => setLoadError(`Couldn't load ${studyTrackFor(trackId)?.title ?? "this section"}.`))
        .finally(() => loadingRef.current.delete(trackId));
    },
    [participants, loadProgress],
  );

  useEffect(() => {
    load(initialSection);
    // Once, on open — the participants list is whoever was active when this
    // was opened, and nothing can change it while this covers the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectSection(id: StudyTrackId) {
    setSectionId(id);
    setLoadError(null);
    if (!progressRef.current[id]) load(id);
  }

  const onCycle = useCallback(
    (personId: string, item: number, unit: number, what: string) => cycle(sectionId, personId, item, unit, what),
    [cycle, sectionId],
  );

  const opened = useCallback(
    (sync: CellSync): Opened => openedRef.current[sync.trackId]?.[studyCellKey(sync.personId, sync.item, sync.unit)] ?? NOT_STUDIED,
    [],
  );

  // Puts boxes back as they were found, then leaves. All or nothing: if it
  // fails, nothing was changed and the screen stays as it is.
  const putBack = useCallback(
    async (boxes: CellSync[], failure: string) => {
      busyRef.current = true;
      setBusy(true);
      setSaveError(null);
      try {
        // Saves still on their way have to land first, or one could land on top of this.
        await whenIdle();
        await restoreStatuses(
          boxes.map((s): StudyRestoreBox => ({ trackId: s.trackId, personId: s.personId, item: s.item, unit: s.unit, status: opened(s).status, statusDate: opened(s).date })),
        );
        onClose();
      } catch {
        busyRef.current = false;
        setBusy(false);
        setSaveError(failure);
      }
    },
    [onClose, opened, restoreStatuses, whenIdle],
  );

  // Close: leaves with the changes kept, and asks nothing. A box tapped away and
  // back was dated today on the way, though it has not moved: give it its own
  // date again.
  const close = useCallback(async () => {
    if (busyRef.current) return;
    const tappedRound = [...syncRef.current.values()].filter((s) => s.sent && s.desired === opened(s).status && s.desired !== "none");
    if (tappedRound.length === 0) return onClose();
    await putBack(tappedRound, "Couldn't finish up — your changes are saved, but a date couldn't be put back. Try closing again.");
  }, [onClose, opened, putBack]);

  // Cancel: everything done since this opened goes back as it was.
  const cancelEdits = useCallback(async () => {
    if (busyRef.current) return;
    const sent = [...syncRef.current.values()].filter((s) => s.sent);
    if (sent.length === 0) return onClose();
    await putBack(sent, "Couldn't undo your changes — they're still as you left them. Try Cancel again.");
  }, [onClose, putBack]);

  const track = studyTrackFor(sectionId) ?? STUDY_SECTIONS[0];
  const loaded = loadedIds.includes(sectionId);
  const error = loadError ?? saveError;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--page-bg)", display: "flex", flexDirection: "column" }}>
      <div className="study-head">
        <h3 className="study-head-title">
          <SectionPicker value={sectionId} onChange={selectSection} disabled={busy} />
        </h3>
        <div className="study-legend">
          <LegendItem status="none" text="Not studied" tone={track.legendTone} />
          <LegendItem status="partial" text="Partly" tone={track.legendTone} />
          <LegendItem status="complete" text="Completed" tone={track.legendTone} />
          <span>Tap a box to cycle</span>
          <span className="study-rotate-hint">Rotate for a wider view</span>
        </div>
        {/* Close keeps what's been done; Cancel undoes all of it. */}
        <div className="study-head-actions">
          <button type="button" className="study-cancel" onClick={() => void cancelEdits()} disabled={busy} title="Undo everything changed since this was opened">
            Cancel
          </button>
          <CloseButton onClick={() => void close()} />
        </div>
      </div>

      {error && (
        <p role="alert" style={{ flexShrink: 0, margin: 0, padding: "0 5% 6px", fontSize: "0.78rem", color: "var(--red)" }}>
          {error}{" "}
          {loadError && (
            <button
              onClick={() => {
                setLoadError(null);
                load(sectionId);
              }}
              style={{ background: "none", border: "none", padding: 0, color: "var(--heading)", textDecoration: "underline", cursor: "pointer", fontSize: "inherit" }}
            >
              Retry
            </button>
          )}
        </p>
      )}

      {/* The one scroll area — the grid's sticky header and label column
          stick to this, in whichever direction it's scrolled. The grid's wrapper
          is never narrower than the grid (so nothing is cut off however far you
          scroll sideways); on a desktop screen it also fills the window, with the
          grid centred and lined up with the heading above (.study-sections in
          globals.css). overscroll-behavior stops the end of a scroll from
          carrying on into the page underneath. */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {participants.length === 0 ? (
          <p style={{ padding: "var(--space-4) 5%", color: "var(--muted)", fontSize: "0.9rem" }}>
            No participants in this activity yet — add some from the roster first.
          </p>
        ) : !loaded ? (
          !loadError && <p style={{ padding: "var(--space-4) 5%", color: "var(--muted)", fontSize: "0.9rem" }}>Loading…</p>
        ) : (
          <div className="study-sections" style={{ ["--study-min" as string]: `${studyGridWidth(track, participants.length)}px` }}>
            <StudyLogGrid track={track} participants={participants} progress={progress[sectionId] ?? NO_PROGRESS} onCycle={onCycle} />
          </div>
        )}
      </div>
    </div>
  );
}
