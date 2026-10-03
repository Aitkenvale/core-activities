"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloseButton } from "@/components/CloseButton";
import { nextStudyStatus, studyCellKey, type StoredStudyStatus, type StudyStatus, type StudyTrack, type StudyTrackId } from "@/lib/studyTracks";
import { StudyLogGrid, studySwatchStyle, type StudyParticipant } from "./StudyLogGrid";

type ProgressRow = { personId: string; item: number; unit: number; status: StoredStudyStatus };

// One map of box states per log: a box's key (person, item, unit) is only
// unique within its own log — Ruhi's Book 1 unit 1 and Branch 1 share one.
type ProgressByTrack = Record<string, Record<string, StudyStatus>>;
const NO_PROGRESS: Record<string, StudyStatus> = {};

// Where a box stands with the server. A box has at most one save in flight;
// taps that land meanwhile just move `desired`, and one follow-up request
// sends the final state once the first finishes — so rapid taps can't reach
// the database out of order, and `server` is always what it last confirmed
// (the value a failed save falls back to).
type CellSync = { inFlight: boolean; desired: StudyStatus; server: StudyStatus };

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
}: {
  title: string;
  tracks: StudyTrack[];
  participants: StudyParticipant[];
  onClose: () => void;
  loadProgress: (trackId: StudyTrackId, personIds: string[]) => Promise<ProgressRow[]>;
  saveStatus: (trackId: StudyTrackId, personId: string, item: number, unit: number, status: StudyStatus) => Promise<unknown>;
}) {
  const [progress, setProgress] = useState<ProgressByTrack>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The latest maps, readable synchronously — a tap needs "what is this box
  // showing right now" even when two taps land before React re-renders.
  const progressRef = useRef<ProgressByTrack>({});
  const syncRef = useRef(new Map<string, CellSync>());

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
    (trackId: StudyTrackId, personId: string, item: number, unit: number, key: string) => {
      const sync = syncRef.current.get(`${trackId}|${key}`);
      if (!sync || sync.inFlight || sync.desired === sync.server) return;
      sync.inFlight = true;
      const sending = sync.desired;
      saveStatus(trackId, personId, item, unit, sending)
        .then(() => {
          sync.server = sending;
        })
        .catch(() => {
          // Whatever was queued behind it is dropped too — back to what
          // the database actually has.
          sync.desired = sync.server;
          setCell(trackId, key, sync.server);
          setSaveError("Couldn't save that change — it's been put back.");
        })
        .finally(() => {
          sync.inFlight = false;
          flush(trackId, personId, item, unit, key);
        });
    },
    [saveStatus, setCell],
  );

  const cycle = useCallback(
    (trackId: StudyTrackId, personId: string, item: number, unit: number) => {
      const key = studyCellKey(personId, item, unit);
      const syncKey = `${trackId}|${key}`;
      let sync = syncRef.current.get(syncKey);
      if (!sync) {
        const current = progressRef.current[trackId]?.[key] ?? "none";
        sync = { inFlight: false, desired: current, server: current };
        syncRef.current.set(syncKey, sync);
      }
      sync.desired = nextStudyStatus(sync.desired);
      setSaveError(null);
      setCell(trackId, key, sync.desired);
      flush(trackId, personId, item, unit, key);
    },
    [flush, setCell],
  );

  // One tap handler per log, the same one between renders, so the boxes a tap
  // didn't touch aren't redrawn.
  const cyclers = useMemo(
    () => Object.fromEntries(tracks.map((t) => [t.id, (personId: string, item: number, unit: number) => cycle(t.id, personId, item, unit)])),
    [tracks, cycle],
  );

  const load = useCallback(() => {
    setLoadError(null);
    setLoaded(false);
    const personIds = participants.map((p) => p.personId);
    Promise.all(tracks.map((t) => loadProgress(t.id, personIds)))
      .then((results) => {
        const maps: ProgressByTrack = {};
        tracks.forEach((t, i) => {
          const map: Record<string, StudyStatus> = {};
          for (const r of results[i]) map[studyCellKey(r.personId, r.item, r.unit)] = r.status;
          maps[t.id] = map;
        });
        progressRef.current = maps;
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

  const error = loadError ?? saveError;
  // One example colour for the legend when every log fills the same way.
  const legendTone = tracks.every((t) => t.legendTone === tracks[0].legendTone) ? tracks[0].legendTone : "neutral";

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
        <CloseButton onClick={onClose} />
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
          stick to this, in whichever direction it's scrolled. Each log's
          section is as wide as its grid (so a heading that sticks to the left
          edge stays there however far you scroll sideways). overscroll-behavior
          stops the end of a scroll from carrying on into the page underneath. */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {participants.length === 0 ? (
          <p style={{ padding: "var(--space-4) 5%", color: "var(--muted)", fontSize: "0.9rem" }}>
            No participants in this activity yet — add some from the roster first.
          </p>
        ) : !loaded ? (
          !loadError && <p style={{ padding: "var(--space-4) 5%", color: "var(--muted)", fontSize: "0.9rem" }}>Loading…</p>
        ) : (
          tracks.map((track) => (
            <section key={track.id} style={{ width: "max-content", minWidth: "100%" }}>
              {tracks.length > 1 && <h4 className="study-section-title">{track.title}</h4>}
              <StudyLogGrid track={track} participants={participants} progress={progress[track.id] ?? NO_PROGRESS} onCycle={cyclers[track.id]} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
