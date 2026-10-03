"use client";

import { memo, useMemo } from "react";
import { formatFullName } from "@/lib/formatName";
import { RUHI_BOOKS, RUHI_UNITS, ruhiCellKey, type RuhiUnitStatus } from "@/lib/ruhi";

export type RuhiParticipant = { personId: string; name: string; preferredName: string | null };

// Fixed sizes rather than content-driven ones: the two header rows have to
// know each other's exact height (the second sticks directly under the
// first), and a column group is always three boxes wide however long
// someone's name is.
const BOOK_COL_W = 64;
const UNIT_COL_W = 40;
const NAME_ROW_H = 32;
const UNIT_ROW_H = 22;
const BODY_ROW_H = 40;

// Row dividers stay quiet (--border is far too bright in dark mode for 14
// rows of them); the line between one person's three boxes and the next
// person's is a step stronger so the groups read as groups.
const ROW_LINE = "1px solid var(--disabled-bg)";
const GROUP_LINE = "1px solid var(--border)";

const STATUS_TEXT: Record<RuhiUnitStatus, string> = {
  none: "not studied",
  partial: "partly studied",
  complete: "completed",
};

// The three looks of a box. Partly and completed both get the green border,
// so what separates the three states is how full the box is, not just which
// colour it is — and the light-green half fill alone wouldn't clear 3:1
// against a white card.
export function ruhiSwatchStyle(status: RuhiUnitStatus): React.CSSProperties {
  if (status === "complete") return { border: "1.5px solid var(--green)", background: "var(--green)" };
  if (status === "partial") {
    return { border: "1.5px solid var(--green)", background: "linear-gradient(to top, var(--green-soft) 50%, transparent 50%)" };
  }
  return { border: "1.5px solid var(--muted)", background: "transparent" };
}

function firstName(p: RuhiParticipant): string {
  return p.preferredName?.trim() || p.name.trim().split(/\s+/)[0] || p.name;
}

// A column header only has room for a short name. Two people who'd end up
// with the same one get their surname initial added so the columns can't be
// mistaken for each other; the full name is always on the header's tooltip
// and every box's accessible label.
function shortNames(participants: RuhiParticipant[]): Map<string, string> {
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
  book,
  unit,
  status,
  who,
  onCycle,
}: {
  personId: string;
  book: number;
  unit: number;
  status: RuhiUnitStatus;
  who: string;
  onCycle: (personId: string, book: number, unit: number) => void;
}) {
  return (
    <td
      style={{
        padding: 0,
        height: BODY_ROW_H,
        background: "var(--card-bg)",
        borderBottom: ROW_LINE,
        borderLeft: unit === 1 ? GROUP_LINE : undefined,
      }}
    >
      {/* The button fills the whole cell (40x40) for a comfortable tap
          target; the visible box is inset inside it. touch-action:
          manipulation keeps a quick double-tap — the normal way to go from
          not studied straight to completed — from zooming the page. */}
      <button
        type="button"
        onClick={() => onCycle(personId, book, unit)}
        aria-label={`${who}, Book ${book} Unit ${unit}: ${STATUS_TEXT[status]}`}
        style={{
          display: "block",
          width: "100%",
          height: BODY_ROW_H,
          padding: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          aria-hidden
          style={{ display: "block", width: "100%", height: "100%", boxSizing: "border-box", borderRadius: 7, ...ruhiSwatchStyle(status) }}
        />
      </button>
    </td>
  );
});

// Names across the top, Book 1..14 down the left, three boxes (U1/U2/U3)
// under each name. Meant to sit inside a scroll container of its own: the
// header rows and the Book column are sticky, so both stay in view whichever
// way the grid is scrolled. A <table> rather than CSS grid because sticky
// grid items can't leave their own grid area, whereas sticky table cells
// stick to the scroll container as you'd expect.
export function RuhiUnitsGrid({
  participants,
  progress,
  onCycle,
}: {
  participants: RuhiParticipant[];
  progress: Record<string, RuhiUnitStatus>;
  onCycle: (personId: string, book: number, unit: number) => void;
}) {
  const labels = useMemo(() => shortNames(participants), [participants]);
  const tableWidth = BOOK_COL_W + participants.length * RUHI_UNITS.length * UNIT_COL_W;

  const headBase: React.CSSProperties = { position: "sticky", background: "var(--table-header-bg)", padding: 0, fontWeight: 500, textAlign: "center" };

  return (
    <table
      style={{
        borderCollapse: "separate",
        borderSpacing: 0,
        tableLayout: "fixed",
        width: tableWidth,
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <colgroup>
        <col style={{ width: BOOK_COL_W }} />
        {participants.flatMap((p) => RUHI_UNITS.map((u) => <col key={`${p.personId}-${u}`} style={{ width: UNIT_COL_W }} />))}
      </colgroup>
      <thead>
        <tr>
          <th scope="col" style={{ ...headBase, top: 0, left: 0, zIndex: 4, height: NAME_ROW_H, fontSize: "0.7rem", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)" }}>
            Book
          </th>
          {participants.map((p) => (
            <th
              key={p.personId}
              scope="colgroup"
              colSpan={RUHI_UNITS.length}
              title={formatFullName(p.name, p.preferredName)}
              style={{ ...headBase, top: 0, zIndex: 3, height: NAME_ROW_H, borderLeft: GROUP_LINE }}
            >
              <span
                style={{
                  display: "block",
                  padding: "0 6px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "0.78rem",
                  lineHeight: `${NAME_ROW_H}px`,
                  color: "var(--text)",
                }}
              >
                {labels.get(p.personId)}
              </span>
            </th>
          ))}
        </tr>
        <tr>
          <th aria-hidden style={{ ...headBase, top: NAME_ROW_H, left: 0, zIndex: 4, height: UNIT_ROW_H, borderBottom: GROUP_LINE }} />
          {participants.flatMap((p) =>
            RUHI_UNITS.map((u) => (
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
      </thead>
      <tbody>
        {RUHI_BOOKS.map((book) => (
          <tr key={book}>
            <th
              scope="row"
              style={{
                position: "sticky",
                left: 0,
                zIndex: 2,
                height: BODY_ROW_H,
                padding: "0 8px",
                background: "var(--table-header-bg)",
                borderBottom: ROW_LINE,
                borderRight: GROUP_LINE,
                textAlign: "left",
                fontSize: "0.78rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                color: "var(--text)",
              }}
            >
              Book {book}
            </th>
            {participants.flatMap((p) =>
              RUHI_UNITS.map((unit) => (
                <Cell
                  key={`${p.personId}-${unit}`}
                  personId={p.personId}
                  book={book}
                  unit={unit}
                  status={progress[ruhiCellKey(p.personId, book, unit)] ?? "none"}
                  who={formatFullName(p.name, p.preferredName)}
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
