import type { ActivityStatus } from "@/app/app/activities/actions";

// Same verb/done-label pattern as the attendance session's Confirm/Confirmed
// pill: a neutral outline (identical for all three, matching the archived
// pill's own look) inviting the action when it's not the current state, a
// bold colour fill naming the resulting state once it is. "End Activity"
// rather than "Close" — "Close" read as ambiguous (closing a popup/form),
// not ending the activity itself.
const STATUS_META: Record<ActivityStatus, { verb: string; done: string; bg: string; text: string }> = {
  active: { verb: "Activate", done: "Active", bg: "#FFFFFF", text: "var(--deep)" },
  paused: { verb: "Pause", done: "Paused", bg: "var(--gold)", text: "var(--deep)" },
  archived: { verb: "End Activity", done: "Ended", bg: "var(--blue)", text: "var(--cream)" },
};
const STATUS_ORDER: ActivityStatus[] = ["active", "paused", "archived"];

// Shared by the Edit/Create Activity form and the admin Edit Activities
// grid — same three states, same one-way-Closed rule (the caller supplies
// `locked` and `onChange`; this component is purely presentational).
export function StatusPills({
  value,
  onChange,
  locked,
  size = "normal",
}: {
  value: ActivityStatus;
  onChange: (v: ActivityStatus) => void;
  locked: boolean;
  size?: "normal" | "compact";
}) {
  const compact = size === "compact";
  return (
    <div style={{ display: "flex", gap: compact ? 4 : 8, flexWrap: "wrap" }}>
      {STATUS_ORDER.map((s) => {
        const meta = STATUS_META[s];
        const isCurrent = value === s;
        // A clean colour badge (no border) only for the current Paused/Ended
        // pill — Active's current state is still a plain white chip (kept
        // bordered so it doesn't disappear against a white card background).
        const coloredFill = isCurrent && s !== "active";
        const disabled = locked && !isCurrent;
        return (
          <button
            key={s}
            onClick={() => !locked && onChange(s)}
            disabled={disabled}
            style={{
              flex: compact ? 1 : undefined,
              padding: compact ? "4px 6px" : "6px 16px",
              borderRadius: "var(--radius-pill)",
              border: coloredFill ? "1px solid transparent" : "1px solid var(--border)",
              background: isCurrent ? meta.bg : "var(--card-bg)",
              color: isCurrent ? meta.text : "var(--muted)",
              fontSize: compact ? "0.68rem" : "0.85rem",
              fontWeight: isCurrent ? 600 : 400,
              cursor: locked ? "default" : "pointer",
              opacity: disabled ? 0.35 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {isCurrent ? meta.done : meta.verb}
          </button>
        );
      })}
    </div>
  );
}
