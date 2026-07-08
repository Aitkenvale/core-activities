"use client";

import { useMemo, useState } from "react";
import { updateHousehold, createHousehold, type HouseholdPatch } from "./actions";

type Row = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  hidden: boolean;
  peopleCount: number;
};

type SortKey = keyof Row;

const COLUMNS: { key: SortKey; label: string; width: number; align?: "left" | "center" }[] = [
  { key: "name", label: "Name", width: 200 },
  { key: "address", label: "Address", width: 260 },
  { key: "peopleCount", label: "People", width: 70, align: "center" },
  { key: "hidden", label: "Hidden", width: 70, align: "center" },
  { key: "notes", label: "Notes", width: 260 },
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

export function HouseholdsGrid({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  function patchLocal(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function save(id: string, patch: HouseholdPatch) {
    updateHousehold(id, patch).catch((e) => console.error("Save failed:", e));
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function sortValue(r: Row, key: SortKey): string {
    const v = r[key];
    return v === null || v === undefined ? "" : String(v);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createHousehold(name);
      setRows((rs) => [...rs, { id: created.id, name: created.name, address: null, notes: null, hidden: false, peopleCount: 0 }]);
      setNewName("");
    } catch (e) {
      console.error("Create failed:", e);
    } finally {
      setCreating(false);
    }
  }

  const visibleRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    let filtered = showHidden ? rows : rows.filter((r) => !r.hidden);
    if (q) {
      filtered = filtered.filter((r) => [r.name, r.address, r.notes].some((v) => v?.toLowerCase().includes(q)));
    }
    return [...filtered].sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortAsc ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filterText, showHidden, sortKey, sortAsc]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 3%" }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--deep)", marginBottom: 16 }}>
        Edit Households ({visibleRows.length})
      </h2>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Search by name, address, notes…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ ...inputStyle, width: 320, border: "1px solid var(--border)" }}
          />
          <button
            onClick={() => setShowHidden((v) => !v)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: `1px solid ${showHidden ? "var(--deep)" : "var(--border)"}`,
              background: showHidden ? "var(--deep)" : "#fff",
              color: showHidden ? "var(--cream)" : "var(--muted)",
              fontSize: "0.75rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Hidden
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="New household name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            style={{ ...inputStyle, width: 220, border: "1px solid var(--border)" }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: "4px 14px",
              fontSize: "0.85rem",
              border: "1px solid var(--deep)",
              background: "var(--deep)",
              color: "var(--cream)",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
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
                    textAlign: col.align ?? "left",
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
                  value={r.address}
                  onSave={(v) => {
                    patchLocal(r.id, { address: v || null });
                    save(r.id, { address: v || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "address"}
                  onEdit={() => setEditing({ id: r.id, field: "address" })}
                  onDone={() => setEditing(null)}
                />
                <td style={{ ...cellStyle, textAlign: "center", color: "var(--muted)" }}>{r.peopleCount}</td>
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
                  value={r.notes}
                  onSave={(v) => {
                    patchLocal(r.id, { notes: v || null });
                    save(r.id, { notes: v || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "notes"}
                  onEdit={() => setEditing({ id: r.id, field: "notes" })}
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
}: {
  value: string | null;
  onSave: (v: string) => void;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
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
