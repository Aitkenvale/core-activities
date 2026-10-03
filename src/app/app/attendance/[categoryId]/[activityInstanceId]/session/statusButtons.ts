import type { CSSProperties } from "react";

// The look the buttons under the roster share; each adds its own colours.
export const actionButtonStyle: CSSProperties = {
  minHeight: "var(--tap-min)",
  padding: "0 16px",
  borderRadius: "var(--radius-pill)",
  fontSize: "0.85rem",
  whiteSpace: "nowrap",
};

// A row of them, centred, and wrapping if a narrow screen can't hold both.
export const buttonRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-2)" };

// Confirm Attendance and Cancel Class. Each presses on and, pressed again,
// off — so "on" is drawn solid in its colour — and they are alternatives: while
// one is on the other is greyed out (`blocked`) and can't be pressed. Neither
// can be pressed at all when the session is out of the edit window
// (`noPermission`), though the one that is on still shows it.
export function toggleButtonStyle({
  tone,
  on,
  blocked,
  noPermission,
}: {
  tone: "green" | "red";
  on: boolean;
  blocked: boolean;
  noPermission: boolean;
}): CSSProperties {
  const colour = tone === "green" ? "var(--green)" : "var(--red)";
  if (blocked && !on) {
    return { ...actionButtonStyle, border: "1px solid var(--border)", background: "var(--disabled-bg)", color: "var(--muted)", cursor: "default", opacity: 0.7 };
  }
  return {
    ...actionButtonStyle,
    border: `1px solid ${colour}`,
    background: on ? colour : "var(--card-bg)",
    color: on ? "var(--card-bg)" : colour,
    cursor: noPermission ? "default" : "pointer",
    opacity: noPermission ? 0.6 : 1,
  };
}
