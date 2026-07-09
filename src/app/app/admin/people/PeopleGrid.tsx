"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { updatePerson, searchHouseholds, type PersonPatch } from "./actions";
import { getCategoryLabel, CATEGORY_LABELS } from "@/lib/category";

type Row = {
  id: string;
  name: string;
  preferredName: string | null;
  householdId: string | null;
  householdName: string | null;
  dob: string | null;
  mobile: string | null;
  email: string | null;
  regoYear: number | null;
  hidden: boolean;
  linkStatus: "linked" | "pending";
  comment: string | null;
};

type SortKey = keyof Row | "category";

// Every column except Comment gets a genuinely fixed width — Comment is left
// with no width set below, so (with table-layout:fixed + table width:100%)
// it's the only column that absorbs whatever space is left over, instead of
// every column stretching proportionally on a wide screen.
const COLUMNS: { key: SortKey; label: string; width: number | undefined }[] = [
  { key: "name", label: "Name", width: 160 },
  { key: "preferredName", label: "AKA", width: 120 },
  { key: "householdName", label: "Household", width: 180 },
  { key: "dob", label: "DOB", width: 130 },
  { key: "category", label: "Category", width: 140 },
  { key: "regoYear", label: "Rego Year", width: 90 },
  { key: "mobile", label: "Mobile", width: 130 },
  { key: "linkStatus", label: "Linked", width: 90 },
  { key: "hidden", label: "Hidden", width: 70 },
  { key: "comment", label: "Comment", width: undefined },
];
const COMMENT_MIN_WIDTH = 180;

// Fixed row height so a cell never grows taller when it switches from
// display text to an input/select/date-input — that vertical resize (native
// date inputs and <select> especially render taller than a plain text input
// unless explicitly constrained) was the page "jitter".
const ROW_HEIGHT = 34;

const cellStyle: React.CSSProperties = {
  height: ROW_HEIGHT,
  padding: "6px 8px",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.85rem",
  verticalAlign: "middle",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: ROW_HEIGHT - 2,
  boxSizing: "border-box",
  fontSize: "0.85rem",
  padding: "4px 6px",
  border: "1px solid var(--gold)",
  borderRadius: 2,
  background: "var(--card-bg)",
  color: "var(--text)",
  // Native <select> otherwise ignores the height above and falls back to
  // the browser's own larger minimum, stretching the whole row.
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

export function PeopleGrid({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [noRegoOnly, setNoRegoOnly] = useState(false);
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);

  function toggleCategory(label: string) {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function patchLocal(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function save(id: string, patch: PersonPatch) {
    updatePerson(id, patch).catch((e) => console.error("Save failed:", e));
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function sortValue(r: Row, key: SortKey): string {
    const v = key === "category" ? getCategoryLabel(r.dob) : r[key];
    return v === null || v === undefined ? "" : String(v);
  }

  const visibleRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    let filtered = showHidden ? rows : rows.filter((r) => !r.hidden);
    if (noRegoOnly) {
      filtered = filtered.filter((r) => r.regoYear === null);
    }
    if (categoryFilter.size > 0) {
      filtered = filtered.filter((r) => categoryFilter.has(getCategoryLabel(r.dob) ?? ""));
    }
    if (q) {
      filtered = filtered.filter((r) =>
        [r.name, r.preferredName, r.householdName, getCategoryLabel(r.dob), r.comment].some((v) => v?.toLowerCase().includes(q)),
      );
    }
    return [...filtered].sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortAsc ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filterText, categoryFilter, showHidden, noRegoOnly, sortKey, sortAsc]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 0" }}>
      {/* 9px = the table's 1px border + its cells' 8px left padding, so the
          title/search line up with the actual text in the rows below. */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--page-bg)", padding: "0 9px 12px" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 12 }}>
          Edit All People ({visibleRows.length})
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Search by name, household, category…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ ...inputStyle, width: 320, border: "1px solid var(--border)" }}
          />
          <Pill active={showHidden} onClick={() => setShowHidden((v) => !v)}>
            Hidden
          </Pill>
          <Pill active={noRegoOnly} onClick={() => setNoRegoOnly((v) => !v)}>
            No Rego
          </Pill>
          <CategoryDropdown selected={categoryFilter} onToggle={toggleCategory} />
        </div>
      </div>

      <div style={{ overflow: "hidden", overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
        {/* width:100% + minWidth (not a fixed width) — stretches to fill a
            wide desktop container (no empty space after Comment), but won't
            shrink columns below a usable size on a narrow screen (the
            wrapper scrolls horizontally instead). table-layout:fixed keeps
            every other column from resizing when a cell switches between
            display text and an input (that was the page "jitter"). */}
        <table
          style={{
            borderCollapse: "collapse",
            tableLayout: "fixed",
            width: "100%",
            minWidth: COLUMNS.reduce((sum, c) => sum + (c.width ?? COMMENT_MIN_WIDTH), 0),
            background: "var(--card-bg)",
          }}
        >
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{
                    ...cellStyle,
                    textAlign: "left",
                    background: "var(--table-header-bg)",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    width: col.width,
                    fontWeight: 500,
                  }}
                >
                  {col.label} {sortKey === col.key ? (sortAsc ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
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
                <TextCell
                  value={r.preferredName}
                  onSave={(v) => {
                    patchLocal(r.id, { preferredName: v || null });
                    save(r.id, { preferredName: v || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "preferredName"}
                  onEdit={() => setEditing({ id: r.id, field: "preferredName" })}
                  onDone={() => setEditing(null)}
                />
                <HouseholdCell
                  row={r}
                  editing={editing?.id === r.id && editing.field === "household"}
                  onEdit={() => setEditing({ id: r.id, field: "household" })}
                  onDone={() => setEditing(null)}
                  onSave={(householdId, householdName) => {
                    patchLocal(r.id, { householdId, householdName });
                    save(r.id, { householdId });
                  }}
                />
                <TextCell
                  type="date"
                  value={r.dob}
                  onSave={(v) => {
                    patchLocal(r.id, { dob: v || null });
                    save(r.id, { dob: v || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "dob"}
                  onEdit={() => setEditing({ id: r.id, field: "dob" })}
                  onDone={() => setEditing(null)}
                />
                {/* Computed live from DOB (matches the old sheet's LOOKUP formula) — not stored, not editable, so it never goes stale as someone ages. */}
                <td style={cellStyle}>{getCategoryLabel(r.dob) || <span style={{ color: "var(--border)" }}>—</span>}</td>
                <TextCell
                  value={r.regoYear === null ? null : String(r.regoYear)}
                  onSave={(v) => {
                    const n = v.trim() ? parseInt(v, 10) : null;
                    patchLocal(r.id, { regoYear: n });
                    save(r.id, { regoYear: n });
                  }}
                  editing={editing?.id === r.id && editing.field === "regoYear"}
                  onEdit={() => setEditing({ id: r.id, field: "regoYear" })}
                  onDone={() => setEditing(null)}
                />
                <TextCell
                  value={r.mobile}
                  onSave={(v) => {
                    patchLocal(r.id, { mobile: v || null });
                    save(r.id, { mobile: v || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "mobile"}
                  onEdit={() => setEditing({ id: r.id, field: "mobile" })}
                  onDone={() => setEditing(null)}
                />
                <td style={cellStyle}>
                  <select
                    value={r.linkStatus}
                    onChange={(e) => {
                      const v = e.target.value as Row["linkStatus"];
                      patchLocal(r.id, { linkStatus: v });
                      save(r.id, { linkStatus: v });
                    }}
                    style={{ ...inputStyle, border: "1px solid var(--border)" }}
                  >
                    <option value="linked">linked</option>
                    <option value="pending">pending</option>
                  </select>
                </td>
                <td style={{ ...cellStyle, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={r.hidden}
                    onChange={(e) => {
                      patchLocal(r.id, { hidden: e.target.checked });
                      save(r.id, { hidden: e.target.checked });
                    }}
                  />
                </td>
                <TextCell
                  value={r.comment}
                  onSave={(v) => {
                    patchLocal(r.id, { comment: v || null });
                    save(r.id, { comment: v || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "comment"}
                  onEdit={() => setEditing({ id: r.id, field: "comment" })}
                  onDone={() => setEditing(null)}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryDropdown({ selected, onToggle }: { selected: Set<string>; onToggle: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const active = selected.size > 0;

  return (
    <div style={{ position: "relative" }}>
      <Pill active={active} onClick={() => setOpen((v) => !v)}>
        Category{active ? ` (${selected.size})` : ""}
      </Pill>
      {open && (
        <>
          {/* Full-screen invisible backdrop to close the menu on outside tap. */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 45 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 50,
              minWidth: 200,
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-elevated)",
              padding: "var(--space-2)",
            }}
          >
            {CATEGORY_LABELS.map((label) => (
              <label
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: "0.8rem", color: "var(--text)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <input type="checkbox" checked={selected.has(label)} onChange={() => onToggle(label)} />
                {label}
              </label>
            ))}
          </div>
        </>
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

function HouseholdCell({
  row,
  editing,
  onEdit,
  onDone,
  onSave,
}: {
  row: Row;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onSave: (householdId: string | null, householdName: string | null) => void;
}) {
  const [query, setQuery] = useState(row.householdName || "");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // The table wraps in an overflow:auto container to allow horizontal
  // scrolling, which also clips any absolutely-positioned child — so the
  // dropdown gets cut off instead of floating over the rest of the page.
  // Portal it to <body> with fixed coordinates to escape that clipping.
  useLayoutEffect(() => {
    if (!editing) return;
    function updatePos() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (rect) setMenuPos({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [editing]);

  if (!editing) {
    return (
      <td style={{ ...cellStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} onClick={onEdit}>
        {row.householdName || <span style={{ color: "var(--border)" }}>—</span>}
      </td>
    );
  }

  async function handleChange(value: string) {
    setQuery(value);
    setResults(await searchHouseholds(value));
  }

  return (
    <td style={cellStyle}>
      <input
        ref={inputRef}
        autoFocus
        placeholder="Search household…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone();
        }}
        style={inputStyle}
      />
      {menuPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: Math.max(menuPos.width, 220),
              zIndex: 1000,
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              maxHeight: 200,
              overflowY: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <button
              onClick={() => {
                onSave(null, null);
                onDone();
              }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: "0.8rem", color: "var(--muted)", border: "none", background: "none", cursor: "pointer" }}
            >
              (no household)
            </button>
            {results.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  onSave(h.id, h.name);
                  onDone();
                }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: "0.8rem", border: "none", background: "none", cursor: "pointer" }}
              >
                {h.name}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </td>
  );
}
