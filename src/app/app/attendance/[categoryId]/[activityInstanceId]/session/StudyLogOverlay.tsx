"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloseButton } from "@/components/CloseButton";
import {
  isRegress,
  nextStudyStatus,
  studyCellKey,
  type StoredStudyStatus,
  type StudyRestoreBox,
  type StudyStatus,
  type StudyTrack,
  type StudyTrackId,
} from "@/lib/studyTracks";
import { STATUS_TEXT, StudyLogGrid, studyGridWidth, studySwatchStyle, type StudyParticipant } from "./StudyLogGrid";

// statusDate is the hidden day the box reached its state: no screen shows it,
// but Cancel needs it to put a box back exactly as it was.
type ProgressRow = { personId: string; item: number; unit: number; status: StoredStudyStatus; statusDate: string | null };

// One map of box states per log: a box's key (person, item, unit) is only
// unique within its own log — Ruhi's Book 1 unit 1 and Branch 1 share one.
type ProgressByTrack = Record<string, Record<string, StudyStatus>>;
const NO_PROGRESS: Record<string, StudyStatus> = {};

// A box as this screen found it when it opened — what Cancel puts back, and
// what the check on the way out compares against. A box with no entry had no row.
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

// What the check on the way out says when boxes have gone backwards.
function setBackMessage(boxes: CellSync[], openedStatus: (sync: CellSync) => StudyStatus): string {
  const shown = boxes.slice(0, 6).map((s) => `• ${s.what}: ${STATUS_TEXT[openedStatus(s)]} → ${STATUS_TEXT[s.desired]}`);
  const more = boxes.length > shown.length ? `\n…and ${boxes.length - shown.length} more` : "";
  const count = boxes.length === 1 ? "1 box has" : `${boxes.length} boxes have`;
  return `${count} been set back since you opened this screen:\n\n${shown.join("\n")}${more}\n\nLeave with these changes?`;
}

function LegendItem({ status, text, tone }: { status: StudyStatus; text: string; tone: StudyTrack["legendTone"] }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, boxSizing: "border-box", ...studySwatchStyle(status, tone) }} />
      {text}
    </span>
  );
}

// The study log (Ruhi Units and Ruhi Branches, Grades, Texts or DSA Courses)
// for an activity's participants — current and former — as a whole-screen
// overlay (same shape as Add Info and Search). An activity that keeps more
// than one log shows a grid for each, one under the other, on this one screen.
// Reading and writing are passed in rather than imported so the screen doesn't
// care where its data comes from — the Attendance page hands it the real
// server actions.
export function StudyLogOverlay({
  title,
  tracks,
  participants,
  onClose,
  loadProgress,
  saveStatus,
  restoreStatuses,
}: {
  title: string;
  tracks: StudyTrack[];
  participants: StudyParticipant[];
  onClose: () => void;
  loadProgress: (trackId: StudyTrackId, personIds: string[]) => Promise<ProgressRow[]>;
  saveStatus: (trackId: StudyTrackId, personId: string, item: number, unit: number, status: StudyStatus) => Promise<unknown>;
  // Puts boxes back exactly as they were, date and all — all or nothing.
  restoreStatuses: (boxes: StudyRestoreBox[]) => Promise<unknown>;
}) {
  const [progress, setProgress] = useState<ProgressByTrack>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Putting boxes back: taps and the buttons wait until it's done.
  const [busy, setBusy] = useState(false);

  // The latest maps, readable synchronously — a tap needs "what is this box
  // showing right now" even when two taps land before React re-renders.
  const progressRef = useRef<ProgressByTrack>({});
  const syncRef = useRef(new Map<string, CellSync>());
  const openedRef = useRef<Record<string, Record<string, Opened>>>({});
  const busyRef = useRef(false);
  // How many saves are on their way, and who is waiting for that to reach none.
  const inFlightRef = useRef(0);
  const idleWaitersRef = useRef<Array<() => void>>([]);

  const setCell = useCallback((trackId: StudyTrackId, key: string, status: StudyStatus) => {
    const cells = { ...progressRef.current[trackId] };
    if (status === "none") delete cells[key];
    else cells[key] = status;
    // Only the edited log's map is replaced, so the other log's boxes keep
    // the props they had.
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
      // No question asked here, however far a box is taken: the one check is
      // on the way out (finish), against how things stood when this opened.
      sync.desired = nextStudyStatus(sync.desired);
      setSaveError(null);
      setCell(trackId, key, sync.desired);
      flush(sync);
    },
    [flush, setCell],
  );

  // One tap handler per log, the same one between renders, so the boxes a tap
  // didn't touch aren't redrawn.
  const cyclers = useMemo(
    () => Object.fromEntries(tracks.map((t) => [t.id, (personId: string, item: number, unit: number, what: string) => cycle(t.id, personId, item, unit, what)])),
    [tracks, cycle],
  );

  const load = useCallback(() => {
    setLoadError(null);
    setLoaded(false);
    const personIds = participants.map((p) => p.personId);
    Promise.all(tracks.map((t) => loadProgress(t.id, personIds)))
      .then((results) => {
        const maps: ProgressByTrack = {};
        const found: Record<string, Record<string, Opened>> = {};
        tracks.forEach((t, i) => {
          const map: Record<string, StudyStatus> = {};
          const was: Record<string, Opened> = {};
          for (const r of results[i]) {
            const key = studyCellKey(r.personId, r.item, r.unit);
            map[key] = r.status;
            was[key] = { status: r.status, date: r.statusDate };
          }
          maps[t.id] = map;
          found[t.id] = was;
        });
        progressRef.current = maps;
        openedRef.current = found;
        syncRef.current.clear();
        setProgress(maps);
        setLoaded(true);
      })
      .catch(() => setLoadError(`Couldn't load ${title}.`));
  }, [participants, loadProgress, tracks, title]);

  useEffect(() => {
    load();
    // Once, on open — the participants list is whoever was active when this
    // was opened, and nothing can change it while this covers the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Leaving with the changes kept. Every tap has already been saved; the one
  // question is if any box ended up behind where it started — judged on the
  // whole visit, not tap by tap, so tapping a box round the cycle and back to
  // where it began asks nothing.
  const finish = useCallback(async () => {
    if (busyRef.current) return;
    const touched = [...syncRef.current.values()];
    const setBack = touched.filter((s) => isRegress(opened(s).status, s.desired));
    if (setBack.length > 0 && !window.confirm(setBackMessage(setBack, (s) => opened(s).status))) return;
    // A box tapped away and back was dated today on the way, though it has
    // not moved: give it its own date again.
    const tappedRound = touched.filter((s) => s.sent && s.desired === opened(s).status && s.desired !== "none");
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

  const error = loadError ?? saveError;
  // One example colour for the legend when every log fills the same way.
  const legendTone = tracks.every((t) => t.legendTone === tracks[0].legendTone) ? tracks[0].legendTone : "neutral";
  // How wide the widest grid needs to be (see .study-sections in globals.css).
  const gridMinWidth = Math.max(...tracks.map((t) => studyGridWidth(t, participants.length)));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--page-bg)", display: "flex", flexDirection: "column" }}>
      <div className="study-head">
        <h3 className="study-head-title" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "var(--heading)" }}>
          {title}
        </h3>
        <div className="study-legend">
          <LegendItem status="none" text="Not studied" tone={legendTone} />
          <LegendItem status="partial" text="Partly" tone={legendTone} />
          <LegendItem status="complete" text="Completed" tone={legendTone} />
          <span>Tap a box to cycle</span>
          <span className="study-rotate-hint">Rotate for a wider view</span>
        </div>
        {/* Close keeps what's been done (asking once if anything went
            backwards); Cancel undoes all of it. */}
        <div className="study-head-actions">
          <button type="button" className="study-cancel" onClick={() => void cancelEdits()} disabled={busy} title="Undo everything changed since this was opened">
            Cancel
          </button>
          <CloseButton onClick={() => void finish()} />
        </div>
      </div>

      {error && (
        <p role="alert" style={{ flexShrink: 0, margin: 0, padding: "0 5% 6px", fontSize: "0.78rem", color: "var(--red)" }}>
          {error}{" "}
          {loadError && (
            <button onClick={load} style={{ background: "none", border: "none", padding: 0, color: "var(--heading)", textDecoration: "underline", cursor: "pointer", fontSize: "inherit" }}>
              Retry
            </button>
          )}
        </p>
      )}

      {/* The one scroll area — each grid's sticky header and label column
          stick to this, in whichever direction it's scrolled. The grids' wrapper
          is never narrower than the widest grid (so a heading that sticks to the
          left edge stays there however far you scroll sideways); on a desktop
          screen it also fills the window, with the grids centred and lined up
          with the heading above (.study-sections in globals.css).
          overscroll-behavior stops the end of a scroll from carrying on into
          the page underneath. */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {participants.length === 0 ? (
          <p style={{ padding: "var(--space-4) 5%", color: "var(--muted)", fontSize: "0.9rem" }}>
            No participants in this activity yet — add some from the roster first.
          </p>
        ) : !loaded ? (
          !loadError && <p style={{ padding: "var(--space-4) 5%", color: "var(--muted)", fontSize: "0.9rem" }}>Loading…</p>
        ) : (
          <div className="study-sections" style={{ ["--study-min" as string]: `${gridMinWidth}px` }}>
            {tracks.map((track) => (
              <section key={track.id}>
                {tracks.length > 1 && <h4 className="study-section-title">{track.title}</h4>}
                <StudyLogGrid track={track} participants={participants} progress={progress[track.id] ?? NO_PROGRESS} onCycle={cyclers[track.id]} />
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
