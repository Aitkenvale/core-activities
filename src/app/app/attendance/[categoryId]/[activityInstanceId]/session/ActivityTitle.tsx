"use client";

import { useEffect, useRef, useState } from "react";
import { renameActivity } from "@/app/app/activities/actions";

// The activity's name, drawn exactly as it always was; clicking it turns it into
// a text box to rename the activity (Enter, or tapping away, saves; Escape puts
// it back). Open to anyone signed in, the same as Edit Activity.
export function ActivityTitle({
  activityInstanceId,
  name,
  onRenamed,
  rename = renameActivity,
}: {
  activityInstanceId: string;
  name: string;
  onRenamed: () => void;
  // Passed in only so the title can be exercised without a login.
  rename?: (activityInstanceId: string, name: string) => Promise<string>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The new name, shown until the page's own copy catches up with it.
  const [saved, setSaved] = useState<{ from: string; to: string } | null>(null);
  const shown = saved && saved.from === name ? saved.to : name;
  // Set once Enter or Escape has dealt with the box, so the tap-away that
  // follows its removal doesn't save (or cancel) a second time.
  const finishedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Into the box with the whole name selected, ready to type over.
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function start() {
    finishedRef.current = false;
    setDraft(shown);
    setError(null);
    setEditing(true);
  }

  async function commit() {
    if (finishedRef.current || saving) return;
    const next = draft.trim();
    if (next === shown) {
      finishedRef.current = true;
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const savedName = await rename(activityInstanceId, next);
      finishedRef.current = true;
      setSaved({ from: name, to: savedName });
      setEditing(false);
      onRenamed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't rename it.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    finishedRef.current = true;
    setEditing(false);
    setError(null);
  }

  return (
    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", textAlign: "center", margin: "0 0 var(--space-4)" }}>
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void commit();
              else if (e.key === "Escape") cancel();
            }}
            onBlur={() => void commit()}
            readOnly={saving}
            aria-label="Activity name"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 0,
              background: "transparent",
              border: "none",
              // An underline that takes no room, so the title doesn't shift as it becomes a box.
              boxShadow: "0 1px 0 var(--heading)",
              borderRadius: 0,
              outline: "none",
              font: "inherit",
              color: "inherit",
              textAlign: "center",
              opacity: saving ? 0.6 : 1,
            }}
          />
          {error && (
            <span role="alert" style={{ display: "block", marginTop: 4, fontFamily: "'Jost', Arial, Helvetica, sans-serif", fontSize: "0.75rem", color: "var(--red)" }}>
              {error}
            </span>
          )}
        </>
      ) : (
        <button type="button" className="activity-title-button" onClick={start} title="Click to rename">
          {shown}
        </button>
      )}
    </h2>
  );
}
