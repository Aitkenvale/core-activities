import type { CSSProperties } from "react";

// The look the four buttons under the roster share; each adds its own colours.
// Each fills its cell of buttonGridStyle, so all four are exactly the same
// width whatever their words — and stay that width as a toggle changes state.
// The padding is slim and the words may wrap, so the longest ("Attendance
// Confirmed") still fits two across on a narrow phone.
export const actionButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "var(--tap-min)",
  padding: "4px 10px",
  borderRadius: "var(--radius-pill)",
  fontSize: "0.85rem",
  lineHeight: 1.15,
  textAlign: "center",
};

// Two equal columns, centred: Confirm Attendance and Cancel Class above Edit
// Participants and Edit Study History, so they line up as a block.
export const buttonGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "var(--space-2)",
  width: "min(100%, 360px)",
  marginLeft: "auto",
  marginRight: "auto",
};

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
