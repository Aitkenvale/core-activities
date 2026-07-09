"use client";

import { useMemo, useState } from "react";
import type { CadenceType, CadenceConfig, Occurrence } from "@/lib/cadence";
import {
  updateActivity,
  setActivityStatus,
  setActivityHidden,
  updateActivityCadence,
  createActivity,
  type ActivityPatch,
} from "./actions";

type Category = { id: string; label: string };
type Neighbourhood = { id: string; name: string };

type Row = {
  id: string;
  name: string;
  categoryId: string;
  categoryLabel: string | null;
  neighbourhoodId: string;
  neighbourhoodName: string | null;
  description: string | null;
  status: "active" | "paused";
  pausedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  hidden: boolean;
  cadenceType: string;
  cadenceConfig: unknown;
};

type SortKey = "name" | "category" | "neighbourhood" | "startDate" | "status";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const OCCURRENCES: Occurrence[] = ["first", "second", "third", "fourth", "last"];
const WEEKDAY_SHORT: Record<string, string> = {
  Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};

function describeCadence(cadenceType: string, cadenceConfig: unknown): string {
  const config = (cadenceConfig ?? {}) as CadenceConfig;
  if (cadenceType === "ad_hoc") return "Ad-hoc";
  if (cadenceType === "school_term") {
    const days = (config.weekdays ?? []).map((w) => WEEKDAY_SHORT[w]).join(", ");
    return `School term · ${days || "—"}`;
  }
  if (cadenceType === "every_n_weeks") {
    const days = (config.weekdays ?? []).map((w) => WEEKDAY_SHORT[w]).join(", ");
    const n = config.intervalWeeks || 1;
    return n <= 1 ? `Weekly · ${days || "—"}` : `Every ${n} weeks · ${days || "—"}`;
  }
  if (cadenceType === "every_n_months") {
    const n = config.intervalMonths || 1;
    const occ = (config.occurrences ?? []).map((o) => `${o.occurrence} ${WEEKDAY_SHORT[o.weekday]}`).join(", ");
    return n <= 1 ? `Monthly · ${occ || "—"}` : `Every ${n} months · ${occ || "—"}`;
  }
  return cadenceType;
}

function weeksPaused(pausedAt: string | null): number | null {
  if (!pausedAt) return null;
  const ms = Date.now() - new Date(`${pausedAt}T00:00:00`).getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

// PSEC / JYSEP / SC / CAMP — the category's own internal code, uppercased,
// rather than the full label ("Junior Youth Group"), to keep this column
// narrow.
function categoryAbbrev(categoryId: string): string {
  return categoryId.toUpperCase();
}

// Every column except Notes gets a genuinely fixed width, on a narrow AND a
// wide screen alike — Notes is the one left with no width set below, so
// (with table-layout:fixed + table width:100%) it's the only column that
// absorbs whatever space is left over, instead of every column stretching
// proportionally and leaving Start Date/Status oddly bloated.
const COLUMN_WIDTHS = {
  name: 260,
  category: 110,
  neighbourhood: 130,
  cadence: 170,
  startDate: 110,
  status: 100,
  hidden: 60,
};
const NOTES_MIN_WIDTH = 150;

// Same ROW_HEIGHT/margin as PeopleGrid and HouseholdsGrid — kept identical
// across all three admin grids so rows visually match between them, not
// just internally consistent within one file. `height` on a table cell is
// only a minimum, not a cap — a native <select>/date input can still render
// taller than requested even with appearance:none, so this needs real
// headroom (not just 1-2px) to reliably win against browser quirks.
const ROW_HEIGHT = 40;

const cellStyle: React.CSSProperties = {
  height: ROW_HEIGHT,
  padding: "6px 8px",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.85rem",
  verticalAlign: "middle",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: ROW_HEIGHT - 6,
  boxSizing: "border-box",
  fontSize: "0.85rem",
  padding: "4px 6px",
  border: "1px solid var(--gold)",
  borderRadius: 2,
  background: "var(--card-bg)",
  color: "var(--text)",
  // Native <select> otherwise ignores the height above and falls back to
  // the browser's own larger minimum, which was making every row in this
  // grid taller than Term Dates' plain-input rows (a row's height follows
  // its tallest cell).
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

export function ActivitiesGrid({
  initialRows,
  categories,
  neighbourhoods,
}: {
  initialRows: Row[];
  categories: Category[];
  neighbourhoods: Neighbourhood[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [filterText, setFilterText] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [cadenceModalFor, setCadenceModalFor] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  function patchLocal(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function save(id: string, patch: ActivityPatch) {
    updateActivity(id, patch).catch((e) => console.error("Save failed:", e));
  }

  function toggleCategory(categoryId: string) {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function sortValue(r: Row, key: SortKey): string {
    switch (key) {
      case "category":
        return r.categoryId ?? "";
      case "neighbourhood":
        return r.neighbourhoodName ?? "";
      case "startDate":
        return r.startDate ?? "";
      case "status":
        return r.status ?? "";
      case "name":
        return r.name ?? "";
    }
  }

  const visibleRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    let filtered = showHidden ? rows : rows.filter((r) => !r.hidden);
    if (categoryFilter.size > 0) {
      filtered = filtered.filter((r) => categoryFilter.has(r.categoryId));
    }
    if (q) {
      filtered = filtered.filter((r) => [r.name, r.categoryLabel, r.neighbourhoodName, r.description].some((v) => v?.toLowerCase().includes(q)));
    }
    return [...filtered].sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortAsc ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filterText, showHidden, categoryFilter, sortKey, sortAsc]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 0" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--page-bg)", padding: "0 9px 12px" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 12 }}>
          Edit Activities ({visibleRows.length})
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Search by name, category, neighbourhood, notes…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ ...inputStyle, width: 320, border: "1px solid var(--border)" }}
          />
          <Pill active={showHidden} onClick={() => setShowHidden((v) => !v)}>
            Hidden
          </Pill>
          <CategoryDropdown categories={categories} selected={categoryFilter} onToggle={toggleCategory} />
          <button
            onClick={() => setAdding(true)}
            style={{
              marginLeft: "auto",
              padding: "6px 14px",
              fontSize: "0.85rem",
              border: "1px solid var(--deep)",
              background: "var(--deep)",
              color: "var(--cream)",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            Add Activity
          </button>
        </div>
      </div>

      <div style={{ overflow: "hidden", overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
        {/* width:100% + minWidth (not a fixed width) — stretches to fill a
            wide desktop container (no empty space after the last column),
            but won't shrink columns below a usable size on a narrow screen
            (the wrapper scrolls horizontally instead). table-layout:fixed
            keeps columns from resizing when a cell switches between
            display text and an input (that was the page "jitter"). */}
        <table
          style={{
            borderCollapse: "collapse",
            tableLayout: "fixed",
            width: "100%",
            minWidth: Object.values(COLUMN_WIDTHS).reduce((a, b) => a + b, 0) + NOTES_MIN_WIDTH,
            background: "var(--card-bg)",
          }}
        >
          <thead>
            <tr>
              {(
                [
                  { label: "Name", width: COLUMN_WIDTHS.name, sortKey: "name" as const },
                  { label: "Category", width: COLUMN_WIDTHS.category, sortKey: "category" as const },
                  { label: "Neighbourhood", width: COLUMN_WIDTHS.neighbourhood, sortKey: "neighbourhood" as const },
                  { label: "Cadence", width: COLUMN_WIDTHS.cadence, sortKey: null },
                  { label: "Start Date", width: COLUMN_WIDTHS.startDate, sortKey: "startDate" as const },
                  { label: "Status", width: COLUMN_WIDTHS.status, sortKey: "status" as const },
                  { label: "Hidden", width: COLUMN_WIDTHS.hidden, sortKey: null },
                  { label: "Notes", width: undefined, sortKey: null }, // no width set — absorbs whatever space is left
                ] satisfies { label: string; width: number | undefined; sortKey: SortKey | null }[]
              ).map((col) => (
                <th
                  key={col.label}
                  onClick={col.sortKey ? () => toggleSort(col.sortKey!) : undefined}
                  style={{
                    ...cellStyle,
                    textAlign: "left",
                    background: "var(--table-header-bg)",
                    whiteSpace: "nowrap",
                    fontWeight: 500,
                    width: col.width,
                    cursor: col.sortKey ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {col.label} {col.sortKey && sortKey === col.sortKey ? (sortAsc ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const weeks = r.status === "paused" ? weeksPaused(r.pausedAt) : null;
              return (
                <tr key={r.id}>
                  <TextCell
                    value={r.name}
                    onSave={(v) => {
                      patchLocal(r.id, { name: v });
                      save(r.id, { name: v });
                    }}
                    editing={editing?.id === r.id && editing.field === "name"}
                    onEdit={() => setEditing({ id: r.id, field: "name" })}
                    onDone={() => setEditing(null)}
                  />
                  <td style={cellStyle}>
                    <select
                      value={r.categoryId}
                      onChange={(e) => {
                        const categoryId = e.target.value;
                        const categoryLabel = categories.find((c) => c.id === categoryId)?.label ?? null;
                        patchLocal(r.id, { categoryId, categoryLabel });
                        save(r.id, { categoryId });
                      }}
                      style={{ ...inputStyle, border: "1px solid var(--border)" }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {categoryAbbrev(c.id)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={cellStyle}>
                    <select
                      value={r.neighbourhoodId}
                      onChange={(e) => {
                        const neighbourhoodId = e.target.value;
                        const neighbourhoodName = neighbourhoods.find((n) => n.id === neighbourhoodId)?.name ?? null;
                        patchLocal(r.id, { neighbourhoodId, neighbourhoodName });
                        save(r.id, { neighbourhoodId });
                      }}
                      style={{ ...inputStyle, border: "1px solid var(--border)" }}
                    >
                      {neighbourhoods.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={cellStyle}>
                    <button
                      onClick={() => setCadenceModalFor(r)}
                      style={{
                        background: "none",
                        border: "1px dashed var(--gold)",
                        borderRadius: 2,
                        padding: "4px 8px",
                        fontSize: "0.8rem",
                        color: "var(--warm)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {describeCadence(r.cadenceType, r.cadenceConfig)}
                    </button>
                  </td>
                  <TextCell
                    type="date"
                    value={r.startDate}
                    onSave={(v) => {
                      patchLocal(r.id, { startDate: v || null });
                      save(r.id, { startDate: v || null });
                    }}
                    editing={editing?.id === r.id && editing.field === "startDate"}
                    onEdit={() => setEditing({ id: r.id, field: "startDate" })}
                    onDone={() => setEditing(null)}
                  />
                  <td style={cellStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          const next = r.status === "active" ? "paused" : "active";
                          patchLocal(r.id, { status: next, pausedAt: next === "paused" ? new Date().toISOString().slice(0, 10) : null });
                          setActivityStatus(r.id, next).catch((e) => console.error("Save failed:", e));
                        }}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 12,
                          border: `1px solid ${r.status === "paused" ? "var(--red)" : "var(--border)"}`,
                          background: r.status === "paused" ? "var(--red)" : "var(--card-bg)",
                          color: r.status === "paused" ? "var(--cream)" : "var(--muted)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.status === "paused" ? "Paused" : "Active"}
                      </button>
                      {weeks !== null && weeks >= 6 && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            background: weeks >= 10 ? "#B3261E" : "#B98900",
                            color: "#fff",
                          }}
                        >
                          {weeks}w paused
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...cellStyle, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={r.hidden}
                      onChange={(e) => {
                        const hidden = e.target.checked;
                        patchLocal(r.id, { hidden, endDate: hidden ? new Date().toISOString().slice(0, 10) : null });
                        setActivityHidden(r.id, hidden).catch((err) => console.error("Save failed:", err));
                      }}
                    />
                  </td>
                  <TextCell
                    value={r.description}
                    onSave={(v) => {
                      patchLocal(r.id, { description: v || null });
                      save(r.id, { description: v || null });
                    }}
                    editing={editing?.id === r.id && editing.field === "description"}
                    onEdit={() => setEditing({ id: r.id, field: "description" })}
                    onDone={() => setEditing(null)}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cadenceModalFor && (
        <CadenceEditorModal
          row={cadenceModalFor}
          onClose={() => setCadenceModalFor(null)}
          onSave={(cadenceType, cadenceConfig) => {
            patchLocal(cadenceModalFor.id, { cadenceType, cadenceConfig });
            updateActivityCadence(cadenceModalFor.id, cadenceType, cadenceConfig).catch((e) => console.error("Save failed:", e));
            setCadenceModalFor(null);
          }}
        />
      )}

      {adding && (
        <AddActivityModal
          categories={categories}
          neighbourhoods={neighbourhoods}
          onClose={() => setAdding(false)}
          onCreated={(row) => {
            setRows((rs) => [...rs, row]);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
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

function CategoryDropdown({
  categories,
  selected,
  onToggle,
}: {
  categories: Category[];
  selected: Set<string>;
  onToggle: (categoryId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = selected.size > 0;

  return (
    <div style={{ position: "relative" }}>
      <Pill active={active} onClick={() => setOpen((v) => !v)}>
        Category{active ? ` (${selected.size})` : ""}
      </Pill>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 45 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 50,
              minWidth: 180,
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-elevated)",
              padding: "var(--space-2)",
            }}
          >
            {categories.map((c) => (
              <label
                key={c.id}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: "0.8rem", color: "var(--text)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => onToggle(c.id)} />
                {categoryAbbrev(c.id)} — {c.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TextCell({
  value,
  onSave,
  editing,
  onEdit,
  onDone,
  type = "text",
}: {
  value: string | null;
  onSave: (v: string) => void;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  type?: "text" | "date";
}) {
  const [draft, setDraft] = useState(value || "");

  if (!editing) {
    return (
      <td style={{ ...cellStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} onClick={onEdit}>
        {value || <span style={{ color: "var(--border)" }}>—</span>}
      </td>
    );
  }

  function commit() {
    onSave(draft);
    onDone();
  }

  return (
    <td style={cellStyle}>
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onDone();
        }}
        style={type === "date" ? { ...inputStyle, fontSize: "0.75rem" } : inputStyle}
      />
    </td>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-6)",
          width: "min(90vw, 480px)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", color: "var(--heading)", marginBottom: "var(--space-4)" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function WeekdayToggles({ selected, onToggle }: { selected: string[]; onToggle: (day: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {WEEKDAYS.map((day) => (
        <button
          key={day}
          onClick={() => onToggle(day)}
          style={{
            padding: "6px 10px",
            borderRadius: 14,
            border: `1px solid ${selected.includes(day) ? "var(--deep)" : "var(--border)"}`,
            background: selected.includes(day) ? "var(--deep)" : "var(--card-bg)",
            color: selected.includes(day) ? "var(--cream)" : "var(--text)",
            fontSize: "0.78rem",
            cursor: "pointer",
          }}
        >
          {WEEKDAY_SHORT[day]}
        </button>
      ))}
    </div>
  );
}

function CadenceEditorModal({
  row,
  onClose,
  onSave,
}: {
  row: Row;
  onClose: () => void;
  onSave: (cadenceType: CadenceType, cadenceConfig: CadenceConfig) => void;
}) {
  const initialConfig = (row.cadenceConfig ?? {}) as CadenceConfig;
  const [type, setType] = useState<CadenceType>((row.cadenceType as CadenceType) || "ad_hoc");
  const [weekdays, setWeekdays] = useState<string[]>(initialConfig.weekdays ?? []);
  const [intervalWeeks, setIntervalWeeks] = useState(initialConfig.intervalWeeks ?? 1);
  const [intervalMonths, setIntervalMonths] = useState(initialConfig.intervalMonths ?? 1);
  const [occurrences, setOccurrences] = useState(initialConfig.occurrences ?? [{ occurrence: "first" as Occurrence, weekday: "Monday" }]);

  function toggleWeekday(day: string) {
    setWeekdays((ws) => (ws.includes(day) ? ws.filter((w) => w !== day) : [...ws, day]));
  }

  function handleSave() {
    let config: CadenceConfig = {};
    if (type === "school_term" || type === "every_n_weeks") {
      config = { weekdays, ...(type === "every_n_weeks" ? { intervalWeeks } : {}) };
    } else if (type === "every_n_months") {
      config = { intervalMonths, occurrences };
    }
    onSave(type, config);
  }

  return (
    <ModalShell title={`Cadence — ${row.name}`} onClose={onClose}>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gap: 6 }}>
          {([
            ["school_term", "School Term (skips holidays)"],
            ["every_n_weeks", "Every N Weeks (use 1 for plain Weekly)"],
            ["every_n_months", "Every N Months"],
            ["ad_hoc", "Ad-hoc (no fixed pattern)"],
          ] as [CadenceType, string][]).map(([value, label]) => (
            <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text)", cursor: "pointer" }}>
              <input type="radio" name="cadenceType" checked={type === value} onChange={() => setType(value)} />
              {label}
            </label>
          ))}
        </div>

        {(type === "school_term" || type === "every_n_weeks") && (
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 6 }}>Meets on:</p>
            <WeekdayToggles selected={weekdays} onToggle={toggleWeekday} />
          </div>
        )}

        {type === "every_n_weeks" && (
          <label style={{ fontSize: "0.85rem", color: "var(--text)" }}>
            Repeat every
            <input
              type="number"
              min={1}
              value={intervalWeeks}
              onChange={(e) => setIntervalWeeks(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ ...inputStyle, width: 60, display: "inline-block", margin: "0 6px" }}
            />
            week(s)
          </label>
        )}

        {type === "every_n_months" && (
          <>
            <label style={{ fontSize: "0.85rem", color: "var(--text)" }}>
              Repeat every
              <input
                type="number"
                min={1}
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ ...inputStyle, width: 60, display: "inline-block", margin: "0 6px" }}
              />
              month(s), on:
            </label>
            <div style={{ display: "grid", gap: 6 }}>
              {occurrences.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    value={o.occurrence}
                    onChange={(e) => setOccurrences((os) => os.map((x, j) => (j === i ? { ...x, occurrence: e.target.value as Occurrence } : x)))}
                    style={{ ...inputStyle, border: "1px solid var(--border)" }}
                  >
                    {OCCURRENCES.map((occ) => (
                      <option key={occ} value={occ}>
                        {occ}
                      </option>
                    ))}
                  </select>
                  <select
                    value={o.weekday}
                    onChange={(e) => setOccurrences((os) => os.map((x, j) => (j === i ? { ...x, weekday: e.target.value } : x)))}
                    style={{ ...inputStyle, border: "1px solid var(--border)" }}
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setOccurrences((os) => os.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => setOccurrences((os) => [...os, { occurrence: "first", weekday: "Monday" }])}
                style={{ background: "none", border: "1px dashed var(--border)", borderRadius: 2, padding: "6px 10px", fontSize: "0.8rem", color: "var(--warm)", cursor: "pointer" }}
              >
                + Add occurrence
              </button>
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer", padding: "8px 12px" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ background: "var(--deep)", color: "var(--cream)", border: "none", borderRadius: 2, padding: "8px 20px", fontSize: "0.85rem", cursor: "pointer" }}
          >
            Save
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function AddActivityModal({
  categories,
  neighbourhoods,
  onClose,
  onCreated,
}: {
  categories: Category[];
  neighbourhoods: Neighbourhood[];
  onClose: () => void;
  onCreated: (row: Row) => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [neighbourhoodId, setNeighbourhoodId] = useState(neighbourhoods[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !categoryId || !neighbourhoodId) return;
    setBusy(true);
    try {
      const created = await createActivity({ name, categoryId, neighbourhoodId, startDate: startDate || null });
      onCreated({
        id: created.id,
        name: created.name,
        categoryId: created.categoryId,
        categoryLabel: categories.find((c) => c.id === created.categoryId)?.label ?? null,
        neighbourhoodId: created.neighbourhoodId,
        neighbourhoodName: neighbourhoods.find((n) => n.id === created.neighbourhoodId)?.name ?? null,
        description: created.description,
        status: created.status as "active" | "paused",
        pausedAt: created.pausedAt,
        startDate: created.startDate,
        endDate: created.endDate,
        hidden: created.hidden,
        cadenceType: created.cadenceType,
        cadenceConfig: created.cadenceConfig,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Add Activity" onClose={onClose}>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, border: "1px solid var(--border)" }} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...inputStyle, border: "1px solid var(--border)" }}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryAbbrev(c.id)}
            </option>
          ))}
        </select>
        <select value={neighbourhoodId} onChange={(e) => setNeighbourhoodId(e.target.value)} style={{ ...inputStyle, border: "1px solid var(--border)" }}>
          {neighbourhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        <label style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          Start date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...inputStyle, border: "1px solid var(--border)", marginTop: 4 }} />
        </label>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Cadence starts as Ad-hoc — set it from the Cadence column after creating.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer", padding: "8px 12px" }}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={busy || !name.trim()}
            style={{ background: "var(--deep)", color: "var(--cream)", border: "none", borderRadius: 2, padding: "8px 20px", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
