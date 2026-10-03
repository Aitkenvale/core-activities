"use client";

import { useMemo, useRef, useState } from "react";
import { studySwatchStyle } from "@/app/app/attendance/[categoryId]/[activityInstanceId]/session/StudyLogGrid";
import { formatCategoryLabel, getCategoryLabel } from "@/lib/category";
import { formatFullName } from "@/lib/formatName";
import {
  studyTrackForCategory,
  studyUnits,
  type StoredStudyStatus,
  type StudyItem,
  type StudyStatus,
  type StudyTone,
  type StudyTrack,
  type StudyTrackId,
} from "@/lib/studyTracks";

export type ReportPerson = { id: string; name: string; preferredName: string | null; dob: string | null };
export type ReportProgressRow = { personId: string; track: string; item: number; unit: number; status: StoredStudyStatus };

// One pill per course, youngest programme first. Ruhi Camps has no pill of its
// own: it works through the same Ruhi units as Study Circles and shares their
// one log (see studyTrackForCategory), so the Study Circles pill already lists
// everyone with Ruhi progress.
const CATEGORIES = [
  { id: "psec", label: "Children's Classes" },
  { id: "jysep", label: "Junior Youth Groups" },
  { id: "sc", label: "Study Circles" },
  { id: "discourse", label: "Discourse Groups" },
];
const VIEWS = CATEGORIES.flatMap((c) => {
  const track = studyTrackForCategory(c.id);
  return track ? [{ ...c, track }] : [];
});

// What "a study item" is in each course: one Grade, one Text, one DSA course —
// and for Ruhi one unit, each of a book's three boxes counting on its own.
const COMPLETED_HEAD: Record<StudyTrackId, string> = {
  psec: "Grades completed",
  jysep: "Texts completed",
  ruhi: "Units completed",
  discourse: "Courses completed",
};

const STATUS_TEXT: Record<StudyStatus, string> = {
  none: "not studied",
  partial: "partly studied",
  complete: "completed",
};

// The three looks of a box in each fill colour, built once and shared by every
// box — the same look the Edit Courses grid and the Attendance screens use.
const TONES: StudyTone[] = ["green", "blue", "mustard"];
const SWATCH = Object.fromEntries(
  TONES.map((tone) => [tone, { none: studySwatchStyle("none", tone), partial: studySwatchStyle("partial", tone), complete: studySwatchStyle("complete", tone) }]),
) as Record<StudyTone, Record<StudyStatus, React.CSSProperties>>;

// Same sizes as the Edit Courses grid; the Completed count gets a column of
// its own that sticks beside the name.
const NAME_COL_W = 230;
const COUNT_COL_W = 104;
const UNIT_COL_W = 26;
const SINGLE_COL_W = 32;

// One column per box a person can tick, in the order they're drawn.
type Column = { key: string; item: StudyItem; unit: number; tdClass: string };

function columnsFor(track: StudyTrack): Column[] {
  const out: Column[] = [];
  track.items.forEach((item, itemIndex) => {
    for (const unit of studyUnits(track)) {
      const first = itemIndex === 0 && unit === 1;
      // A faint line between Ruhi books keeps each book's three boxes together.
      const firstInBook = track.units > 1 && unit === 1 && !first;
      out.push({ key: `${item.id}:${unit}`, item, unit, tdClass: `cg-cell${first ? " cg-cell--group" : firstInBook ? " cg-cell--book" : ""}` });
    }
  });
  return out;
}

type ReportRow = {
  id: string;
  display: string;
  categoryText: string;
  sortKey: string;
  // `${item}:${unit}` -> the box's state; a box that isn't there is not studied.
  cells: Record<string, StoredStudyStatus>;
  // Study items completed, plus half for anything partly done (see credit).
  score: number;
  // The furthest box into the course with any progress, left to right: how
  // high up the grades (or texts, books, courses) they have got.
  reach: number;
  // The same tally per item, for sorting by that item's heading.
  itemScore: Record<number, number>;
};

// A partly done item is worth half an item — once, however many are partly
// done, so a pile of half-finished items never outranks one more finished one.
const credit = (completed: number, anyPartial: boolean) => completed + (anyPartial ? 0.5 : 0);
const formatScore = (score: number) => (Number.isInteger(score) ? String(score) : score.toFixed(1));

type SortKey = "name" | "completed" | `item:${number}`;
type Sort = { key: SortKey; dir: "asc" | "desc" };

// Furthest along first: most study items completed (a partly done one counts
// half), then whoever has got into the higher grades, then A to Z.
const DEFAULT_SORT: Sort = { key: "completed", dir: "desc" };
// A heading's first click: names read best A to Z, the counts biggest first.
const firstDirection = (key: SortKey): Sort["dir"] => (key === "name" ? "asc" : "desc");

// Whichever heading is sorted on, people who tie come out A to Z. The
// Completed tally also breaks its own ties by how high up the course people
// have got, in whichever direction it is sorted.
function compareFor(sort: Sort): (a: ReportRow, b: ReportRow) => number {
  const dir = sort.dir === "asc" ? 1 : -1;
  const byName = (a: ReportRow, b: ReportRow) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id);
  if (sort.key === "name") return (a, b) => dir * byName(a, b);
  if (sort.key === "completed") return (a, b) => dir * (a.score - b.score) || dir * (a.reach - b.reach) || byName(a, b);
  const item = Number(sort.key.slice("item:".length));
  return (a, b) => dir * ((a.itemScore[item] ?? 0) - (b.itemScore[item] ?? 0)) || byName(a, b);
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        border: `1px solid ${active ? "var(--deep)" : "var(--border)"}`,
        background: active ? "var(--deep)" : "var(--card-bg)",
        color: active ? "var(--cream)" : "var(--muted)",
        fontSize: "0.75rem",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function LegendItem({ status, text }: { status: StudyStatus; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, boxSizing: "border-box", ...studySwatchStyle(status, "neutral") }} />
      {text}
    </span>
  );
}

// A column heading you can click to sort by. The arrow's slot is always
// there, so a heading doesn't shift when it becomes the sorted one.
function SortButton({
  label,
  hint,
  dir,
  onClick,
  stacked,
  children,
}: {
  label: string;
  hint?: string;
  dir: Sort["dir"] | null;
  onClick: () => void;
  stacked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={`cr-sort${stacked ? " cr-sort--stacked" : ""}`} onClick={onClick} title={`Sort by ${label}${hint ? `. ${hint}` : ""}`}>
      {children}
      <span aria-hidden className="cr-arrow">
        {dir === "asc" ? "▲" : dir === "desc" ? "▼" : ""}
      </span>
    </button>
  );
}

// Who has got how far in one kind of course: everyone with at least one box
// partly or fully done, biggest tally first, with the same boxes as the Edit
// Courses grid — but nothing to click except the headings, which re-sort.
export function CourseReport({ people, progress }: { people: ReportPerson[]; progress: ReportProgressRow[] }) {
  const [categoryId, setCategoryId] = useState(VIEWS[0].id);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const scrollRef = useRef<HTMLDivElement>(null);

  const view = VIEWS.find((v) => v.id === categoryId) ?? VIEWS[0];
  const track = view.track;
  const stacked = track.units > 1;

  const columns = useMemo(() => columnsFor(track), [track]);

  // Only a box that really exists in this course counts, and a person only
  // gets a row once they have one — a stored box is always partly or fully done.
  const rows = useMemo<ReportRow[]>(() => {
    const peopleById = new Map(people.map((p) => [p.id, p]));
    const validItems = new Set(track.items.map((i) => i.id));
    // Where each box sits in the course, left to right: "higher" means later.
    const position = new Map<string, number>();
    track.items.forEach((item, i) => {
      for (const unit of studyUnits(track)) position.set(`${item.id}:${unit}`, i * track.units + unit - 1);
    });
    const byPerson = new Map<string, ReportRow>();
    for (const r of progress) {
      if (r.track !== track.id || !validItems.has(r.item) || r.unit < 1 || r.unit > track.units) continue;
      const p = peopleById.get(r.personId);
      if (!p) continue;
      let row = byPerson.get(p.id);
      if (!row) {
        const categoryLabel = getCategoryLabel(p.dob);
        row = {
          id: p.id,
          display: formatFullName(p.name, p.preferredName),
          categoryText: categoryLabel ? formatCategoryLabel(categoryLabel) : "No date of birth",
          sortKey: (p.preferredName || p.name).toLowerCase(),
          cells: {},
          score: 0,
          reach: -1,
          itemScore: {},
        };
        byPerson.set(p.id, row);
      }
      row.cells[`${r.item}:${r.unit}`] = r.status;
    }
    for (const row of byPerson.values()) {
      let completed = 0;
      let anyPartial = false;
      const itemCompleted: Record<number, number> = {};
      const itemPartial: Record<number, boolean> = {};
      for (const [key, status] of Object.entries(row.cells)) {
        const item = Number(key.split(":")[0]);
        if (status === "complete") {
          completed += 1;
          itemCompleted[item] = (itemCompleted[item] ?? 0) + 1;
        } else {
          anyPartial = true;
          itemPartial[item] = true;
        }
        row.reach = Math.max(row.reach, position.get(key) ?? -1);
      }
      row.score = credit(completed, anyPartial);
      for (const item of track.items) row.itemScore[item.id] = credit(itemCompleted[item.id] ?? 0, itemPartial[item.id] ?? false);
    }
    return [...byPerson.values()];
  }, [people, progress, track]);

  const sorted = useMemo(() => [...rows].sort(compareFor(sort)), [rows, sort]);

  function pickCategory(id: string) {
    if (id === categoryId) return;
    setCategoryId(id);
    // Another course has other columns, so the old sort means nothing there.
    setSort(DEFAULT_SORT);
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }

  function sortBy(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: firstDirection(key) }));
  }

  const dirOf = (key: SortKey) => (sort.key === key ? sort.dir : null);
  const ariaSort = (key: SortKey) => (sort.key !== key ? undefined : sort.dir === "asc" ? ("ascending" as const) : ("descending" as const));

  const tableWidth = NAME_COL_W + COUNT_COL_W + columns.length * (stacked ? UNIT_COL_W : SINGLE_COL_W);
  // The Edit Courses header sizes, minus its group row; a course with one box
  // per person gets the whole header height for its labels to run up.
  const tableStyle = {
    width: tableWidth,
    "--cr-name-w": `${NAME_COL_W}px`,
    "--cg-group-h": "0px",
    "--cg-course-h": stacked ? "30px" : "118px",
    "--cg-unit-h": stacked ? "22px" : "0px",
  } as React.CSSProperties;
  const headRows = stacked ? 2 : 1;
  const sharedLog = view.id === "sc";

  return (
    // Fills the page (main is the scroll container and this is its only child)
    // so the table below can be the thing that scrolls, in both directions,
    // keeping its headings and name column in view.
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "0 9px var(--space-3)" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 12 }}>
          Course Report ({sorted.length})
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {VIEWS.map((v) => (
            <Pill key={v.id} active={v.id === view.id} onClick={() => pickCategory(v.id)}>
              {v.label}
            </Pill>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto", fontSize: "0.72rem", color: "var(--muted)", flexWrap: "wrap" }}>
            <LegendItem status="none" text="Not studied" />
            <LegendItem status="partial" text="Partly" />
            <LegendItem status="complete" text="Completed" />
          </div>
        </div>
        {sharedLog && (
          <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
            Study Circles and Ruhi Camps keep one shared record of Ruhi units, so this lists everyone with Ruhi progress from either.
          </p>
        )}
      </div>

      <div className="cg-scroll" ref={scrollRef}>
        <table className="cg-table" style={tableStyle}>
          <colgroup>
            <col style={{ width: NAME_COL_W }} />
            <col style={{ width: COUNT_COL_W }} />
            {columns.map((col) => (
              <col key={col.key} style={{ width: stacked ? UNIT_COL_W : SINGLE_COL_W }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={headRows} scope="col" className="cg-corner" aria-sort={ariaSort("name")}>
                <SortButton label="name" dir={dirOf("name")} onClick={() => sortBy("name")}>
                  Name
                </SortButton>
              </th>
              <th rowSpan={headRows} scope="col" className="cg-corner cr-count-head" aria-sort={ariaSort("completed")}>
                <SortButton
                  label={COMPLETED_HEAD[track.id].toLowerCase()}
                  hint="A partly done item counts as a half (once, however many are). Ties go to whoever is furthest into the course, then A to Z."
                  dir={dirOf("completed")}
                  onClick={() => sortBy("completed")}
                >
                  {COMPLETED_HEAD[track.id]}
                </SortButton>
              </th>
              {track.items.map((item, i) => {
                const key: SortKey = `item:${item.id}`;
                const edge = i === 0 ? " cg-edge--group" : stacked ? " cg-edge--book" : "";
                return stacked ? (
                  <th key={item.id} scope="colgroup" colSpan={track.units} className={`cg-course${edge}`} aria-sort={ariaSort(key)}>
                    <SortButton label={item.label} dir={dirOf(key)} onClick={() => sortBy(key)}>
                      {item.label}
                    </SortButton>
                  </th>
                ) : (
                  // A single box per person: the label runs up the column
                  // (wrapping onto a second line when it's long).
                  <th key={item.id} scope="col" className={`cg-course${edge}`} aria-sort={ariaSort(key)}>
                    <SortButton label={item.label} dir={dirOf(key)} onClick={() => sortBy(key)} stacked>
                      <span className="cg-vert">{item.label}</span>
                    </SortButton>
                  </th>
                );
              })}
            </tr>
            {stacked && (
              <tr>
                {track.items.flatMap((item, i) =>
                  studyUnits(track).map((u) => (
                    <th key={`${item.id}:${u}`} scope="col" className={`cg-unit${u === 1 ? (i === 0 ? " cg-edge--group" : " cg-edge--book") : ""}`}>
                      U{u}
                    </th>
                  )),
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {sorted.map((person) => (
              <tr key={person.id} className="cg-row">
                <th scope="row" className="cg-name" title={person.display}>
                  <span className="cg-name-main">{person.display}</span>
                  <span className="cg-name-sub">{person.categoryText}</span>
                </th>
                <td className="cr-count">{formatScore(person.score)}</td>
                {columns.map((col) => {
                  const status: StudyStatus = person.cells[col.key] ?? "none";
                  return (
                    <td key={col.key} className={col.tdClass}>
                      <span
                        role="img"
                        className="cg-box cg-box--static"
                        style={SWATCH[col.item.tone][status]}
                        aria-label={`${person.display}, ${col.item.label}${stacked ? ` Unit ${col.unit}` : ""}: ${STATUS_TEXT[status]}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <p style={{ padding: "var(--space-4)", color: "var(--muted)", fontSize: "0.85rem" }}>Nobody has started this course yet.</p>}
      </div>
    </div>
  );
}
