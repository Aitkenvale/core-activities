"use client";

import { useState } from "react";
import { updateEnforceDarkMode } from "./actions";
import { cardStyle, cardTitleStyle } from "./styles";

// Saves immediately on toggle (no debounce needed for a checkbox) — then
// reloads so this admin sees the effect right away, since the theme is
// decided server-side in the root layout, not something a client-side
// state change here can repaint on its own. Anyone else's already-open tab
// picks it up on their next navigation/reload.
export function AppearanceCard({ initialEnforceDarkMode }: { initialEnforceDarkMode: boolean }) {
  const [enforceDarkMode, setEnforceDarkMode] = useState(initialEnforceDarkMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(checked: boolean) {
    setEnforceDarkMode(checked);
    setSaving(true);
    setError(null);
    try {
      await updateEnforceDarkMode(checked);
      window.location.reload();
    } catch (e) {
      setEnforceDarkMode(!checked);
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
      setSaving(false);
    }
  }

  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>Appearance</h3>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.85rem", color: "var(--text)", cursor: "pointer" }}>
        <input type="checkbox" checked={enforceDarkMode} disabled={saving} onChange={(e) => handleChange(e.target.checked)} />
        Enforce dark mode
      </label>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "6px 0 0" }}>
        Always renders in dark mode for everyone, regardless of their own device&rsquo;s light/dark setting.
      </p>
      {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
