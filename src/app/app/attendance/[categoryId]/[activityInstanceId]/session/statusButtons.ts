import type { CSSProperties } from "react";

// The shape the buttons above the roster share. Each fills its cell of
// buttonGridStyle, so they are all exactly the same width whatever their words —
// and stay that width as a toggle changes state. The padding is slim and the words
// may wrap, so the longest ("Attendance Confirmed") still fits two across on a
// narrow phone.
export const actionButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "var(--tap-min)",
  padding: "4px 10px",
  borderRadius: "var(--radius-pill)",
  fontSize: "0.85rem",
  lineHeight: 1.15,
  textAlign: "center",
};

// Two equal columns, centred: up to four buttons, two by two. A session that is
// confirmed or cancelled shows just two, side by side in the first row.
export const buttonGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "var(--space-2)",
  width: "min(100%, 360px)",
  marginLeft: "auto",
  marginRight: "auto",
};

// What every one of those buttons looks like: a thin border, the card's colour and
// the ordinary text colour (the look Edit Attendees always had). Confirm
// Attendance used to be green, Cancel Class red and Edit Study History blue.
export const plainButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  border: "1px solid var(--border)",
  background: "var(--card-bg)",
  color: "var(--text)",
  cursor: "pointer",
};

// Confirm Attendance and Cancel Class. Each presses on and, pressed again, off,
// and "on" is drawn filled the way a pressed toggle is elsewhere in the app (the
// deep brown with cream text), so Confirm Attendance and Attendance Confirmed are
// easy to tell apart. They are alternatives, so only the one that is on is shown
// once either is pressed. Neither can be pressed at all when the session is out of
// the edit window (`noPermission`), though the one that is on still shows it.
export function toggleButtonStyle({ on, noPermission }: { on: boolean; noPermission: boolean }): CSSProperties {
  return {
    ...plainButtonStyle,
    background: on ? "var(--deep)" : "var(--card-bg)",
    color: on ? "var(--cream)" : "var(--text)",
    cursor: noPermission ? "default" : "pointer",
    opacity: noPermission ? 0.6 : 1,
  };
}
