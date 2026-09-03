"use client";

import { useEffect, useRef, useState } from "react";
import { updateEditWindowMonths } from "./actions";
import { cardStyle, cardTitleStyle } from "./styles";

// How long to wait after the last keystroke before auto-saving — long
// enough that typing "12" doesn't fire a save after just the "1".
const AUTOSAVE_DELAY_MS = 700;

export function SecurityCard({ initialMonths }: { initialMonths: number }) {
  const [months, setMonths] = useState(initialMonths);
  const [draft, setDraft] = useState(String(initialMonths));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 1 || n === months) {
      setError(draft.trim() && (!Number.isFinite(n) || n < 1) ? "Enter a whole number of at least 1." : null);
      return;
    }
    setError(null);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateEditWindowMonths(n);
        setMonths(n);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that change.");
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>Security</h3>
      <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text)", marginBottom: 6 }}>
        Non-admin edit window (months)
      </label>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 10px" }}>
        Facilitators can only edit sessions within this many months of today. Admins are always unrestricted.
      </p>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <input
          type="number"
          min={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            width: 80,
            minHeight: "var(--tap-min)",
            boxSizing: "border-box",
            fontSize: "0.9rem",
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--card-bg)",
            color: "var(--text)",
          }}
        />
        <button
          disabled
          style={{
            minHeight: "var(--tap-min)",
            padding: "0 20px",
            borderRadius: "var(--radius-pill)",
            border: "none",
            background: "var(--disabled-bg)",
            color: "var(--muted)",
            fontSize: "0.85rem",
            cursor: "default",
          }}
        >
          {saving ? "Saving…" : "Auto-Save"}
        </button>
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
