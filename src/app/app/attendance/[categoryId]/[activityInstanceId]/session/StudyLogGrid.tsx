"use client";

import { memo, useMemo } from "react";
import { formatFullName } from "@/lib/formatName";
import { studyCellKey, studyUnits, type StudyStatus, type StudyTone, type StudyTrack } from "@/lib/studyTracks";

// `active` is false for someone hidden from the activity's roster since — they
// stay in the grid, with their name greyed, so their log can still be filled in.
export type StudyParticipant = { personId: string; name: string; preferredName: string | null; active: boolean };

// Fixed sizes rather than content-driven ones: Ruhi's two header rows have to
// know each other's exact height (the second sticks directly under the
// first), and a person's column group is always the same width however long
// their name is.
const NAME_ROW_H = 32;
const UNIT_ROW_H = 22;
const LABEL_COL_W = 64;
const BODY_ROW_H = 40;
const SWATCH = 28;
// Ruhi packs three boxes under each name, so its columns are narrow. A track
// with one box per person gives that box a wider column, wide enough for a
// first name to sit above it.
const UNIT_COL_W = 40;
const SINGLE_COL_W = 60;
// The Junior Youth texts have long names, so their label column is wider and
// wraps (up to three lines), with taller rows to hold them.
const LONG_LABEL_COL_W = 116;
const LONG_BODY_ROW_H = 46;

// Row dividers stay quiet (--border is far too bright in dark mode for 14
// rows of them); the line between one person's boxes and the next person's is
// a step stronger so the groups read as groups.
const ROW_LINE = "1px solid var(--disabled-bg)";
const GROUP_LINE = "1px solid var(--border)";

export const STATUS_TEXT: Record<StudyStatus, string> = {
  none: "not studied",
  partial: "partly studied",
  complete: "completed",
};

// What a row's boxes fill with: its full colour, and the lighter tint for the
// half fill. "neutral" is only for the legend of a track whose rows don't all
// share one colour.
const TONES: Record<StudyTone | "neutral", { solid: string; soft: string }> = {
  green: { solid: "var(--green)", soft: "var(--green-soft)" },
  blue: { solid: "var(--blue)", soft: "var(--blue-soft)" },
  mustard: { solid: "var(--mustard)", soft: "var(--mustard-soft)" },
  neutral: { solid: "var(--muted)", soft: "var(--muted)" },
};

// The three looks of a box. Partly and completed both get the full-colour
// border, so what separates the three states is how full the box is, not
// just which colour it is — and the light half fill alone wouldn't clear 3:1
// against a white card. A box that hasn't been started is only a quiet outline
// (--box-empty, still about 3:1 against the card), so the ones that have been
// stand out. Every study-log screen draws its boxes through this.
export function studySwatchStyle(status: StudyStatus, tone: StudyTone | "neutral" = "green"): React.CSSProperties {
  const { solid, soft } = TONES[tone];
  if (status === "complete") return { border: `1.5px solid ${solid}`, background: solid };
  if (status === "partial") {
    return { border: `1.5px solid ${solid}`, background: `linear-gradient(to top, ${soft} 50%, transparent 50%)` };
  }
  return { border: "1.5px solid var(--box-empty)", background: "transparent" };
}

// How faded a former participant's name is — enough to read as "not current",
// not so much that it looks disabled (their boxes work exactly the same). Still
// clears 4.5:1 against the header in both themes.
const INACTIVE_NAME_OPACITY = 0.65;

// What the header tooltip and every box's accessible label call someone. The
// grey alone isn't enough to say they're no longer active, so it's said in words too.
function describe(p: StudyParticipant): string {
  const full = formatFullName(p.name, p.preferredName);
  return p.active ? full : `${full} (no longer active)`;
}

function firstName(p: StudyParticipant): string {
  return p.preferredName?.trim() || p.name.trim().split(/\s+/)[0] || p.name;
}

// A column header only has room for a short name. Two people who'd end up
// with the same one get their surname initial added so the columns can't be
// mistaken for each other; the full name is always on the header's tooltip
// and every box's accessible label.
function shortNames(participants: StudyParticipant[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const p of participants) {
    const key = firstName(p).toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map(
    participants.map((p) => {
      const first = firstName(p);
      if ((counts.get(first.toLowerCase()) ?? 0) < 2) return [p.personId, first] as const;
      const words = p.name.trim().split(/\s+/);
      const initial = words.length > 1 ? words[words.length - 1][0]?.toUpperCase() : "";
      return [p.personId, initial ? `${first} ${initial}.` : first] as const;
    }),
  );
}

const Cell = memo(function Cell({
  personId,
  item,
  unit,
  status,
  tone,
  label,
  who,
  showUnits,
  rowH,
  onCycle,
}: {
  personId: string;
  item: number;
  unit: number;
  status: StudyStatus;
  tone: StudyTone;
  label: string;
  who: string;
  showUnits: boolean;
  rowH: number;
  // `what` names the box in words ("Ana, Book 1 Unit 2"), for the question asked before a box goes backwards.
  onCycle: (personId: string, item: number, unit: number, what: string) => void;
}) {
  const what = `${who}, ${label}${showUnits ? ` Unit ${unit}` : ""}`;
  return (
    <td
      style={{
        padding: 0,
        height: rowH,
        background: "var(--card-bg)",
        borderBottom: ROW_LINE,
        borderLeft: unit === 1 ? GROUP_LINE : undefined,
      }}
    >
      {/* The button fills the whole cell for a comfortable tap target; the
          visible box is centred inside it. touch-action: manipulation keeps
          a quick double-tap — the normal way to go from not studied straight
          to completed — from zooming the page. */}
      <button
        type="button"
        onClick={() => onCycle(personId, item, unit, what)}
        aria-label={`${what}: ${STATUS_TEXT[status]}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: rowH,
          padding: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          aria-hidden
          style={{ display: "block", width: SWATCH, height: SWATCH, flexShrink: 0, boxSizing: "border-box", borderRadius: 7, ...studySwatchStyle(status, tone) }}
        />
      </button>
    </td>
  );
});

// The narrowest a log's grid can be: its label column plus every box column.
// The overlay needs it too, to size the area the grids sit in.
export function studyGridWidth(track: StudyTrack, participantCount: number): number {
  const colW = track.units > 1 ? UNIT_COL_W : SINGLE_COL_W;
  const labelW = track.longLabels ? LONG_LABEL_COL_W : LABEL_COL_W;
  return labelW + participantCount * studyUnits(track).length * colW;
}

// Names across the top, the track's rows down the left, and a box (Ruhi: three
// boxes, U1/U2/U3) under each name. Meant to sit inside a scroll container of
// its own: the header row(s) and the label column are sticky, so both stay in
// view whichever way the grid is scrolled. A <table> rather than CSS grid
// because sticky grid items can't leave their own grid area, whereas sticky
// table cells stick to the scroll container as you'd expect.
export function StudyLogGrid({
  track,
  participants,
  progress,
  onCycle,
}: {
  track: StudyTrack;
  participants: StudyParticipant[];
  progress: Record<string, StudyStatus>;
  // `what` names the box in words ("Ana, Book 1 Unit 2"), for the question asked before a box goes backwards.
  onCycle: (personId: string, item: number, unit: number, what: string) => void;
}) {
  const labels = useMemo(() => shortNames(participants), [participants]);
  const units = useMemo(() => studyUnits(track), [track]);

  const showUnits = track.units > 1;
  const labelW = track.longLabels ? LONG_LABEL_COL_W : LABEL_COL_W;
  const rowH = track.longLabels ? LONG_BODY_ROW_H : BODY_ROW_H;
  const tableWidth = studyGridWidth(track, participants.length);

  const headBase: React.CSSProperties = { position: "sticky", background: "var(--table-header-bg)", padding: 0, fontWeight: 500, textAlign: "center" };
  // With no unit row beneath it, the name row is the last header row and
  // carries the line under the header itself.
  const lastHeaderLine = showUnits ? undefined : GROUP_LINE;

  return (
    <table
      className="study-table"
      style={{
        borderCollapse: "separate",
        borderSpacing: 0,
        tableLayout: "fixed",
        // Never narrower than its columns need; --study-w is the width it has on a phone
        // (see .study-table in globals.css, which lets it fill the window on a desktop).
        minWidth: tableWidth,
        ["--study-w" as string]: `${tableWidth}px`,
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {/* Only the label column has a width of its own: on a phone the table is
          exactly as wide as the columns need, so the others come out at colW
          each; on a desktop, where it grows to fill the window, the extra width
          is shared equally between them and the labels stay as they were. */}
      <colgroup>
        <col style={{ width: labelW }} />
        {participants.flatMap((p) => units.map((u) => <col key={`${p.personId}-${u}`} />))}
      </colgroup>
      <thead>
        <tr>
          <th
            scope="col"
            style={{
              ...headBase,
              top: 0,
              left: 0,
              zIndex: 4,
              height: NAME_ROW_H,
              fontSize: "0.7rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--muted)",
              borderBottom: lastHeaderLine,
            }}
          >
            {track.cornerLabel}
          </th>
          {participants.map((p) => (
            <th
              key={p.personId}
              scope={showUnits ? "colgroup" : "col"}
              colSpan={units.length}
              title={describe(p)}
              style={{ ...headBase, top: 0, zIndex: 3, height: NAME_ROW_H, borderLeft: GROUP_LINE, borderBottom: lastHeaderLine }}
            >
              <span
                style={{
                  display: "block",
                  padding: showUnits ? "0 6px" : "0 2px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: showUnits ? "0.78rem" : "0.72rem",
                  lineHeight: `${NAME_ROW_H}px`,
                  color: "var(--text)",
                  opacity: p.active ? undefined : INACTIVE_NAME_OPACITY,
                }}
              >
                {labels.get(p.personId)}
              </span>
            </th>
          ))}
        </tr>
        {showUnits && (
          <tr>
            <th aria-hidden style={{ ...headBase, top: NAME_ROW_H, left: 0, zIndex: 4, height: UNIT_ROW_H, borderBottom: GROUP_LINE }} />
            {participants.flatMap((p) =>
              units.map((u) => (
                <th
                  key={`${p.personId}-${u}`}
                  scope="col"
                  style={{
                    ...headBase,
                    top: NAME_ROW_H,
                    zIndex: 3,
                    height: UNIT_ROW_H,
                    lineHeight: `${UNIT_ROW_H}px`,
                    fontSize: "0.68rem",
                    color: "var(--muted)",
                    borderBottom: GROUP_LINE,
                    borderLeft: u === 1 ? GROUP_LINE : undefined,
                  }}
                >
                  U{u}
                </th>
              )),
            )}
          </tr>
        )}
      </thead>
      <tbody>
        {track.items.map((item) => (
          <tr key={item.id}>
            <th
              scope="row"
              style={{
                position: "sticky",
                left: 0,
                zIndex: 2,
                height: rowH,
                padding: "0 8px",
                background: "var(--table-header-bg)",
                borderBottom: ROW_LINE,
                borderRight: GROUP_LINE,
                textAlign: "left",
                fontSize: track.longLabels ? "0.72rem" : "0.78rem",
                lineHeight: track.longLabels ? 1.18 : undefined,
                fontWeight: 500,
                whiteSpace: track.longLabels ? "normal" : "nowrap",
                overflowWrap: track.longLabels ? "break-word" : undefined,
                color: "var(--text)",
              }}
            >
              {item.label}
            </th>
            {participants.flatMap((p) =>
              units.map((unit) => (
                <Cell
                  key={`${p.personId}-${unit}`}
                  personId={p.personId}
                  item={item.id}
                  unit={unit}
                  status={progress[studyCellKey(p.personId, item.id, unit)] ?? "none"}
                  tone={item.tone}
                  label={item.label}
                  who={describe(p)}
                  showUnits={showUnits}
                  rowH={rowH}
                  onCycle={onCycle}
                />
              )),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
