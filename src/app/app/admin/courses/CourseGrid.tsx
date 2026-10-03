"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { setStudyStatus } from "@/app/app/attendance/[categoryId]/[activityInstanceId]/session/studyActions";
import { studySwatchStyle } from "@/app/app/attendance/[categoryId]/[activityInstanceId]/session/StudyLogGrid";
import { CATEGORY_LABELS, formatCategoryLabel, getCategoryLabel } from "@/lib/category";
import { formatFullName } from "@/lib/formatName";
import {
  isRegress,
  nextStudyStatus,
  studyTrackFor,
  studyUnits,
  type StoredStudyStatus,
  type StudyItem,
  type StudyStatus,
  type StudyTone,
  type StudyTrack,
  type StudyTrackId,
} from "@/lib/studyTracks";

export type CoursePerson = { id: string; name: string; preferredName: string | null; dob: string | null };
export type CourseProgressRow = { personId: string; track: string; item: number; unit: number; status: StoredStudyStatus };

// Youngest programme first, left to right.
const TRACK_ORDER: StudyTrackId[] = ["psec", "jysep", "ruhi", "ruhi_branches", "discourse"];
// "DSA" rather than something longer: the group is only two columns wide, and
// its title has to fit inside that.
const GROUP_TITLE: Record<StudyTrackId, string> = {
  psec: "Children's Grades",
  jysep: "Junior Youth Texts",
  ruhi: "Ruhi Books",
  ruhi_branches: "Ruhi Branches",
  discourse: "DSA",
};
const TRACKS = TRACK_ORDER.map(studyTrackFor).filter((t): t is StudyTrack => t !== null);

// The age pills are keyed by category label — plus this one, for people with
// no date of birth and therefore no category at all.
const NO_AGE = "no-age";

const STATUS_TEXT: Record<StudyStatus, string> = {
  none: "not studied",
  partial: "partly studied",
  complete: "completed",
};

// The three looks of a box in each fill colour, built once and shared by
// every box on screen — there are about 17,000 of them, so none gets its own
// style object. The look itself is the same one the Attendance screens use.
const TONES: StudyTone[] = ["green", "blue", "mustard"];
const SWATCH = Object.fromEntries(
  TONES.map((tone) => [tone, { none: studySwatchStyle("none", tone), partial: studySwatchStyle("partial", tone), complete: studySwatchStyle("complete", tone) }]),
) as Record<StudyTone, Record<StudyStatus, React.CSSProperties>>;

// One column per box a person can tick, in the order they're drawn.
type Column = {
  index: number;
  // Unique within a person: `${track}:${item}:${unit}`.
  key: string;
  track: StudyTrack;
  item: StudyItem;
  unit: number;
  tdClass: string;
};

const COLUMNS: Column[] = [];
for (const track of TRACKS) {
  track.items.forEach((item, itemIndex) => {
    for (const unit of studyUnits(track)) {
      const firstInGroup = itemIndex === 0 && unit === 1;
      // A faint line between Ruhi books keeps each book's three boxes together.
      const firstInBook = track.units > 1 && unit === 1 && !firstInGroup;
      COLUMNS.push({
        index: COLUMNS.length,
        key: `${track.id}:${item.id}:${unit}`,
        track,
        item,
        unit,
        tdClass: `cg-cell${firstInGroup ? " cg-cell--group" : firstInBook ? " cg-cell--book" : ""}`,
      });
    }
  });
}

// Ruhi packs three boxes under each book, so its columns are narrow; a track
// with one box per person gives it a column wide enough for the label above
// to run up it on two lines. A fixed table layout only applies when the table
// has an explicit width, hence the total.
const NAME_COL_W = 230;
const UNIT_COL_W = 26;
const SINGLE_COL_W = 32;
const colWidth = (col: Column) => (col.track.units > 1 ? UNIT_COL_W : SINGLE_COL_W);
const TABLE_WIDTH = NAME_COL_W + COLUMNS.reduce((sum, col) => sum + colWidth(col), 0);

type PersonProgress = Record<string, StudyStatus>;

function buildProgress(rows: CourseProgressRow[]): Record<string, PersonProgress> {
  const out: Record<string, PersonProgress> = {};
  for (const r of rows) {
    if (!studyTrackFor(r.track)) continue;
    (out[r.personId] ??= {})[`${r.track}:${r.item}:${r.unit}`] = r.status;
  }
  return out;
}

// Where a box stands with the server. A box has at most one save in flight;
// clicks that land meanwhile just move `desired`, and the same loop sends the
// final state once the first save finishes — so rapid clicks can't reach the
// database out of order, and `server` is always what it last confirmed (the
// value a failed save falls back to). Same rule as the Attendance screens'
// study logs.
type CellSync = { inFlight: boolean; desired: StudyStatus; server: StudyStatus };

type PersonRow = {
  id: string;
  display: string;
  categoryLabel: string | null;
  categoryText: string;
  searchText: string;
  sortKey: string;
};

const Row = memo(function Row({ person, cells }: { person: PersonRow; cells: PersonProgress | undefined }) {
  return (
    <tr className="cg-row" data-person={person.id}>
      <th scope="row" className="cg-name" title={person.display}>
        <span className="cg-name-main">{person.display}</span>
        <span className="cg-name-sub">{person.categoryText}</span>
      </th>
      {COLUMNS.map((col) => {
        const status = cells?.[col.key] ?? "none";
        return (
          <td key={col.key} className={col.tdClass}>
            <button
              type="button"
              className="cg-box"
              data-col={col.index}
              style={SWATCH[col.item.tone][status]}
              aria-label={`${person.display}, ${col.item.label}${col.track.units > 1 ? ` Unit ${col.unit}` : ""}: ${STATUS_TEXT[status]}`}
            />
          </td>
        );
      })}
    </tr>
  );
});

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

// Every person down the side, every course across the top — Children's
// Grades, Junior Youth Texts, then Ruhi Books with their three units — so an
// admin can fill in or correct anyone's log without going through an
// activity's roster. Clicking a box cycles it: not studied, partly, completed.
export function CourseGrid({
  people,
  initialProgress,
  saveStatus = setStudyStatus,
}: {
  people: CoursePerson[];
  initialProgress: CourseProgressRow[];
  // Passed in only so the screen can be exercised without a login.
  saveStatus?: (trackId: string, personId: string, item: number, unit: number, status: StudyStatus) => Promise<unknown>;
}) {
  const [filterText, setFilterText] = useState("");
  const [ageFilter, setAgeFilter] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(() => buildProgress(initialProgress));
  const [error, setError] = useState<string | null>(null);

  // The latest map, readable synchronously — a click needs "what is this box
  // showing right now" even when two clicks land before React re-renders.
  const progressRef = useRef(progress);
  const syncRef = useRef(new Map<string, CellSync>());

  const rows = useMemo<PersonRow[]>(
    () =>
      people
        .map((p) => {
          const categoryLabel = getCategoryLabel(p.dob);
          return {
            id: p.id,
            display: formatFullName(p.name, p.preferredName),
            categoryLabel,
            categoryText: categoryLabel ? formatCategoryLabel(categoryLabel) : "No date of birth",
            searchText: `${p.name} ${p.preferredName ?? ""}`.toLowerCase(),
            sortKey: (p.preferredName || p.name).toLowerCase(),
          };
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
    [people],
  );

  // No pills selected means everyone; with pills selected, anyone in any of
  // them (No Age being the people without a date of birth).
  const visible = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return rows.filter((r) => (ageFilter.size === 0 || ageFilter.has(r.categoryLabel ?? NO_AGE)) && (!q || r.searchText.includes(q)));
  }, [rows, filterText, ageFilter]);

  function toggleAge(label: string) {
    setAgeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const setCell = useCallback((personId: string, colKey: string, status: StudyStatus) => {
    const person = { ...progressRef.current[personId] };
    if (status === "none") delete person[colKey];
    else person[colKey] = status;
    // Only the edited person's map is replaced, so every other row keeps the
    // same reference and doesn't re-render.
    const next = { ...progressRef.current, [personId]: person };
    progressRef.current = next;
    setProgress(next);
  }, []);

  const flush = useCallback(
    async (col: Column, personId: string, syncKey: string) => {
      const sync = syncRef.current.get(syncKey);
      if (!sync || sync.inFlight) return;
      sync.inFlight = true;
      try {
        while (sync.desired !== sync.server) {
          const sending = sync.desired;
          try {
            await saveStatus(col.track.id, personId, col.item.id, col.unit, sending);
            sync.server = sending;
          } catch {
            // Whatever was queued behind it is dropped too — back to what
            // the database actually has.
            sync.desired = sync.server;
            setCell(personId, col.key, sync.server);
            setError("Couldn't save that change — it's been put back.");
            break;
          }
        }
      } finally {
        sync.inFlight = false;
      }
    },
    [saveStatus, setCell],
  );

  const displayById = useMemo(() => new Map(rows.map((r) => [r.id, r.display])), [rows]);

  const cycle = useCallback(
    (personId: string, col: Column) => {
      const syncKey = `${personId}:${col.key}`;
      let sync = syncRef.current.get(syncKey);
      if (!sync) {
        const current = progressRef.current[personId]?.[col.key] ?? "none";
        sync = { inFlight: false, desired: current, server: current };
        syncRef.current.set(syncKey, sync);
      }
      const next = nextStudyStatus(sync.desired);
      // The last tap in the cycle takes a completed box back to not studied —
      // ask first, so a stray click can't quietly undo someone's progress.
      // Cancel leaves the box exactly as it was.
      if (isRegress(sync.desired, next)) {
        const what = `${displayById.get(personId) ?? "this person"}, ${col.item.label}${col.track.units > 1 ? ` Unit ${col.unit}` : ""}`;
        if (!window.confirm(`Set ${what} back to not studied?\n\nIt is marked completed.`)) return;
      }
      sync.desired = next;
      setError(null);
      setCell(personId, col.key, sync.desired);
      void flush(col, personId, syncKey);
    },
    [displayById, flush, setCell],
  );

  // One handler for the whole table rather than one per box: each of the
  // thousands of boxes just carries its column's index, and its row carries
  // the person.
  function handleBodyClick(e: React.MouseEvent<HTMLTableSectionElement>) {
    const box = (e.target as HTMLElement).closest<HTMLElement>("button[data-col]");
    const personId = box?.closest<HTMLElement>("tr[data-person]")?.dataset.person;
    if (!box || !personId) return;
    const col = COLUMNS[Number(box.dataset.col)];
    if (col) cycle(personId, col);
  }

  return (
    // Fills the page (main is the scroll container and this is its only child)
    // so the table below can be the thing that scrolls, in both directions,
    // keeping its course headings and name column in view.
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "0 9px var(--space-3)" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 12 }}>
          Edit Courses ({visible.length})
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            aria-label="Search people"
            placeholder="Search by name…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              width: 320,
              boxSizing: "border-box",
              fontSize: "0.85rem",
              minHeight: "var(--tap-min)",
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--card-bg)",
              color: "var(--text)",
            }}
          />
          {CATEGORY_LABELS.map((label) => (
            <Pill key={label} active={ageFilter.has(label)} onClick={() => toggleAge(label)}>
              {formatCategoryLabel(label)}
            </Pill>
          ))}
          <Pill active={ageFilter.has(NO_AGE)} onClick={() => toggleAge(NO_AGE)}>
            No Age
          </Pill>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto", fontSize: "0.72rem", color: "var(--muted)", flexWrap: "wrap" }}>
            <LegendItem status="none" text="Not studied" />
            <LegendItem status="partial" text="Partly" />
            <LegendItem status="complete" text="Completed" />
            <span>Click a box to change it</span>
          </div>
        </div>
        {error && (
          <p role="alert" style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--red)" }}>
            {error}
          </p>
        )}
      </div>

      <div className="cg-scroll">
        <table className="cg-table" style={{ width: TABLE_WIDTH }}>
          <colgroup>
            <col style={{ width: NAME_COL_W }} />
            {COLUMNS.map((col) => (
              <col key={col.key} style={{ width: colWidth(col) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={3} scope="col" className="cg-corner">
                Name
              </th>
              {TRACKS.map((t) => (
                <th key={t.id} scope="colgroup" colSpan={t.items.length * t.units} className="cg-group">
                  {/* Sticks beside the name column while any of its group is
                      on screen, rather than sitting centred in a group that
                      can be far wider than the window. */}
                  <span className="cg-group-label">{GROUP_TITLE[t.id]}</span>
                </th>
              ))}
            </tr>
            <tr>
              {TRACKS.flatMap((t) =>
                t.items.map((item, i) => {
                  const edge = i === 0 ? " cg-edge--group" : t.units > 1 ? " cg-edge--book" : "";
                  return t.units > 1 ? (
                    <th key={`${t.id}:${item.id}`} scope="colgroup" colSpan={t.units} className={`cg-course${edge}`}>
                      {item.label}
                    </th>
                  ) : (
                    // A single box per person: the label runs up the column
                    // (wrapping onto a second line when it's long) and
                    // reaches down through the unit row beneath.
                    <th key={`${t.id}:${item.id}`} scope="col" rowSpan={2} className={`cg-course cg-course--rot${edge}`}>
                      <span className="cg-vert">{item.label}</span>
                    </th>
                  );
                }),
              )}
            </tr>
            <tr>
              {TRACKS.filter((t) => t.units > 1).flatMap((t) =>
                t.items.flatMap((item, i) =>
                  studyUnits(t).map((u) => (
                    <th key={`${t.id}:${item.id}:${u}`} scope="col" className={`cg-unit${u === 1 ? (i === 0 ? " cg-edge--group" : " cg-edge--book") : ""}`}>
                      U{u}
                    </th>
                  )),
                ),
              )}
            </tr>
          </thead>
          <tbody onClick={handleBodyClick}>
            {visible.map((person) => (
              <Row key={person.id} person={person} cells={progress[person.id]} />
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p style={{ padding: "var(--space-4)", color: "var(--muted)", fontSize: "0.85rem" }}>No matching people.</p>}
      </div>
    </div>
  );
}
