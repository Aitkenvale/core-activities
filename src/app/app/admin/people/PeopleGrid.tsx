"use client";

import { useMemo, useState } from "react";
import { updatePerson, searchHouseholds, type PersonPatch } from "./actions";
import { getCategoryLabel } from "@/lib/category";

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

const COLUMNS: { key: SortKey; label: string; width: number }[] = [
  { key: "name", label: "Name", width: 160 },
  { key: "preferredName", label: "AKA", width: 120 },
  { key: "householdName", label: "Household", width: 180 },
  { key: "dob", label: "DOB", width: 130 },
  { key: "category", label: "Category", width: 140 },
  { key: "regoYear", label: "Rego Year", width: 90 },
  { key: "mobile", label: "Mobile", width: 130 },
  { key: "linkStatus", label: "Linked", width: 90 },
  { key: "hidden", label: "Hidden", width: 70 },
  { key: "comment", label: "Comment", width: 220 },
];

const cellStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.85rem",
  verticalAlign: "middle",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "0.85rem",
  padding: "4px 6px",
  border: "1px solid var(--gold)",
  borderRadius: 2,
  background: "#fff",
};

export function PeopleGrid({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);

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
    let filtered = rows;
    if (q) {
      filtered = rows.filter((r) =>
        [r.name, r.preferredName, r.householdName, getCategoryLabel(r.dob), r.comment].some((v) => v?.toLowerCase().includes(q)),
      );
    }
    return [...filtered].sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortAsc ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filterText, sortKey, sortAsc]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 3%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--deep)" }}>
          Edit All People ({visibleRows.length})
        </h2>
        <input
          placeholder="Filter by name, household, category…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ ...inputStyle, width: 320, border: "1px solid var(--border)" }}
        />
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 4 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{
                    ...cellStyle,
                    textAlign: "left",
                    background: "var(--cream2)",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    minWidth: col.width,
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
      <td style={cellStyle} onClick={onEdit}>
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
        style={inputStyle}
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

  if (!editing) {
    return (
      <td style={cellStyle} onClick={onEdit}>
        {row.householdName || <span style={{ color: "var(--border)" }}>—</span>}
      </td>
    );
  }

  async function handleChange(value: string) {
    setQuery(value);
    setResults(await searchHouseholds(value));
  }

  return (
    <td style={{ ...cellStyle, position: "relative" }}>
      <input
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
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          zIndex: 10,
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 2,
          minWidth: 220,
          maxHeight: 200,
          overflowY: "auto",
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
      </div>
    </td>
  );
}
