"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/CloseButton";
import { nextRuhiStatus, ruhiCellKey, type RuhiUnitStatus, type StoredRuhiUnitStatus } from "@/lib/ruhi";
import { RuhiUnitsGrid, ruhiSwatchStyle, type RuhiParticipant } from "./RuhiUnitsGrid";

type ProgressRow = { personId: string; book: number; unit: number; status: StoredRuhiUnitStatus };

// Where a box stands with the server. A box has at most one save in flight;
// taps that land meanwhile just move `desired`, and one follow-up request
// sends the final state once the first finishes — so rapid taps can't reach
// the database out of order, and `server` is always what it last confirmed
// (the value a failed save falls back to).
type CellSync = { inFlight: boolean; desired: RuhiUnitStatus; server: RuhiUnitStatus };

function LegendItem({ status, text }: { status: RuhiUnitStatus; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, boxSizing: "border-box", ...ruhiSwatchStyle(status) }} />
      {text}
    </span>
  );
}

// The Ruhi study log for an activity's active participants, as a
// whole-screen overlay (same shape as Add Info and Search). Reading and
// writing are passed in rather than imported so the screen doesn't care
// where its data comes from — the Attendance page hands it the real server
// actions.
export function RuhiUnitsOverlay({
  participants,
  onClose,
  loadProgress,
  saveStatus,
}: {
  participants: RuhiParticipant[];
  onClose: () => void;
  loadProgress: (personIds: string[]) => Promise<ProgressRow[]>;
  saveStatus: (personId: string, book: number, unit: number, status: RuhiUnitStatus) => Promise<unknown>;
}) {
  const [progress, setProgress] = useState<Record<string, RuhiUnitStatus>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The latest map, readable synchronously — a tap needs "what is this box
  // showing right now" even when two taps land before React re-renders.
  const progressRef = useRef<Record<string, RuhiUnitStatus>>({});
  const syncRef = useRef(new Map<string, CellSync>());

  const setCell = useCallback((key: string, status: RuhiUnitStatus) => {
    const next = { ...progressRef.current };
    if (status === "none") delete next[key];
    else next[key] = status;
    progressRef.current = next;
    setProgress(next);
  }, []);

  const flush = useCallback(
    (personId: string, book: number, unit: number, key: string) => {
      const sync = syncRef.current.get(key);
      if (!sync || sync.inFlight || sync.desired === sync.server) return;
      sync.inFlight = true;
      const sending = sync.desired;
      saveStatus(personId, book, unit, sending)
        .then(() => {
          sync.server = sending;
        })
        .catch(() => {
          // Whatever was queued behind it is dropped too — back to what
          // the database actually has.
          sync.desired = sync.server;
          setCell(key, sync.server);
          setSaveError("Couldn't save that change — it's been put back.");
        })
        .finally(() => {
          sync.inFlight = false;
          flush(personId, book, unit, key);
        });
    },
    [saveStatus, setCell],
  );

  const cycle = useCallback(
    (personId: string, book: number, unit: number) => {
      const key = ruhiCellKey(personId, book, unit);
      let sync = syncRef.current.get(key);
      if (!sync) {
        const current = progressRef.current[key] ?? "none";
        sync = { inFlight: false, desired: current, server: current };
        syncRef.current.set(key, sync);
      }
      sync.desired = nextRuhiStatus(sync.desired);
      setSaveError(null);
      setCell(key, sync.desired);
      flush(personId, book, unit, key);
    },
    [flush, setCell],
  );

  const load = useCallback(() => {
    setLoadError(null);
    setLoaded(false);
    loadProgress(participants.map((p) => p.personId))
      .then((rows) => {
        const map: Record<string, RuhiUnitStatus> = {};
        for (const r of rows) map[ruhiCellKey(r.personId, r.book, r.unit)] = r.status;
        progressRef.current = map;
        syncRef.current.clear();
        setProgress(map);
        setLoaded(true);
      })
      .catch(() => setLoadError("Couldn't load the Ruhi log."));
  }, [participants, loadProgress]);

  useEffect(() => {
    load();
    // Once, on open — the participants list is whoever was active when this
    // was opened, and nothing can change it while this covers the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const error = loadError ?? saveError;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--page-bg)", display: "flex", flexDirection: "column" }}>
      <div className="ruhi-head">
        <h3 className="ruhi-head-title" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "var(--heading)" }}>
          Ruhi Units
        </h3>
        <div className="ruhi-legend">
          <LegendItem status="none" text="Not studied" />
          <LegendItem status="partial" text="Partly" />
          <LegendItem status="complete" text="Completed" />
          <span>Tap a box to cycle</span>
          <span className="ruhi-rotate-hint">Rotate for a wider view</span>
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

      {/* The one scroll area — the grid's sticky header and Book column
          stick to this, in whichever direction it's scrolled.
          overscroll-behavior stops the end of a scroll from carrying on
          into the page underneath. */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {participants.length === 0 ? (
          <p style={{ padding: "var(--space-4) 5%", color: "var(--muted)", fontSize: "0.9rem" }}>
            No active participants in this activity yet — add some from the roster first.
          </p>
        ) : !loaded ? (
          !loadError && <p style={{ padding: "var(--space-4) 5%", color: "var(--muted)", fontSize: "0.9rem" }}>Loading…</p>
        ) : (
          <RuhiUnitsGrid participants={participants} progress={progress} onCycle={cycle} />
        )}
      </div>
    </div>
  );
}
