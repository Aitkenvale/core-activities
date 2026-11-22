"use client";

import { useRef, useState } from "react";
import { CloseButton } from "@/components/CloseButton";
import { formatFullName } from "@/lib/formatName";

export type PersonMatch = { id: string; name: string; preferredName: string | null; linkStatus: "linked" | "pending" };

// How someone already on the roster stands, as the Attendance screen shows them.
// "listed": they are on the screen being added from. "hidden": they have been
// hidden from the roster, and are brought back with Show in Edit Attendees, not by
// being added again.
export type RosterState = "listed" | "hidden";

// fontSize must be >= 16px — anything smaller makes iOS Safari auto-zoom the
// whole page on focus, and it doesn't reliably zoom back out on blur.
const searchFieldStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  // On a big window the field keeps the width it has on a phone, at the left,
  // with the X still at the far right (the same shape as the Add Info screen).
  maxWidth: 430,
  boxSizing: "border-box",
  fontSize: 16,
  minHeight: "var(--tap-min)",
  padding: "6px 12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
};

// The screen behind each "+ Add New Participant / Teacher / Co-Teacher" button,
// whole-screen like Add Info and Search (and above Edit Attendees when that is
// open). The search field is at the top left and the X, which cancels, at the top
// right. Typing lists the people already in the system, and tapping one adds them
// to the section; "+ Create new" adds whatever was typed as a new person. Either
// way the screen then closes (onDone). Reading and writing are passed in rather
// than imported so the screen doesn't care where its data comes from — the
// Attendance screen hands it the real server actions.
//
// Adding someone who is already on the roster would only re-set their role to this
// section's (a Co-Teacher picked under Teachers would become a Teacher, with nothing
// written to the dated role history the Attendance Records PDF reads), so the
// people in `alreadyOnRoster` are marked in the results and can't be picked: the
// same protection as the admin Enrol Attendees popup, which sets them aside with a
// note (see EnrolAttendeesModal).
export function AddPersonScreen({
  roleLabel,
  alreadyOnRoster,
  search,
  createNew,
  addExisting,
  onDone,
  onCancel,
}: {
  // What the section calls the people being added ("Participant", "Co-Teacher"),
  // for the field's prompt: this screen has no section heading of its own.
  roleLabel: string;
  // The people (by id) who can't be added because they already have a place on the
  // roster this screen is adding to.
  alreadyOnRoster?: ReadonlyMap<string, RosterState>;
  search: (query: string) => Promise<PersonMatch[]>;
  createNew: (name: string) => Promise<unknown>;
  addExisting: (personId: string) => Promise<unknown>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Answers can arrive out of order when typing quickly: only the latest
  // typing's answer is shown.
  const latestSearch = useRef(0);
  // Whether an add is on its way, readable at once: a second tap must not add a
  // second person before the buttons have been redrawn as disabled.
  const busyRef = useRef(false);

  async function handleChange(value: string) {
    setQuery(value);
    setError(null);
    const mine = ++latestSearch.current;
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const found = await search(value);
      if (mine === latestSearch.current) setResults(found);
    } catch {
      if (mine !== latestSearch.current) return;
      setResults([]);
      setError("Couldn't search just now — please try again.");
    }
  }

  async function add(action: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      busyRef.current = false;
      setBusy(false);
      setError("Couldn't add that person — please try again.");
      return;
    }
    onDone();
  }

  const name = query.trim();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--page-bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", padding: "16px 5%" }}>
        <input
          autoFocus
          aria-label={`Search for someone to add as ${roleLabel}`}
          placeholder={`Add ${roleLabel}: type a name…`}
          value={query}
          onChange={(e) => void handleChange(e.target.value)}
          style={searchFieldStyle}
        />
        <CloseButton onClick={onCancel} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: "0 5% 24px" }}>
        <div style={{ maxWidth: 430, display: "grid", gap: "var(--space-1)" }}>
          {/* Only once there is a name to create, as with the Add button on the
              date popover: nothing to press until then. */}
          {name && (
            <button
              onClick={() => void add(() => createNew(name))}
              disabled={busy}
              style={{
                textAlign: "left",
                minHeight: "var(--tap-min)",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--gold)",
                background: "var(--cream2)",
                color: "var(--warm)",
                fontSize: "0.85rem",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              + Create new: &quot;{name}&quot;
            </button>
          )}
          {results.map((r) => {
            const rosterState = alreadyOnRoster?.get(r.id);
            const onRoster = rosterState !== undefined;
            return (
              <button
                key={r.id}
                onClick={() => void add(() => addExisting(r.id))}
                disabled={busy || onRoster}
                style={{
                  textAlign: "left",
                  minHeight: "var(--tap-min)",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--card-bg)",
                  color: "var(--text)",
                  fontSize: "0.85rem",
                  cursor: busy || onRoster ? "default" : "pointer",
                  opacity: busy || onRoster ? 0.6 : 1,
                }}
              >
                {formatFullName(r.name, r.preferredName)}
                {r.linkStatus === "pending" && <span style={{ color: "var(--muted)" }}> (not linked)</span>}
                {rosterState === "listed" && <span style={{ color: "var(--muted)" }}> (already on this roster)</span>}
                {rosterState === "hidden" && <span style={{ color: "var(--muted)" }}> (hidden from this roster)</span>}
              </button>
            );
          })}
          {error && (
            <p role="alert" style={{ color: "var(--red)", fontSize: "0.78rem", margin: "var(--space-2) 0 0" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
