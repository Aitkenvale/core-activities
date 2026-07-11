"use client";

import { useEffect, useState } from "react";
import { searchPeopleForPicker } from "./actions";
import { formatFullName } from "@/lib/formatName";
import { CATEGORY_LABELS, FACILITATOR_INELIGIBLE_CATEGORIES, PARTICIPANT_INELIGIBLE_CATEGORIES, formatCategoryLabel } from "@/lib/category";

export type PickedPerson =
  | { kind: "existing"; id: string; name: string; preferredName: string | null; linkStatus: "linked" | "pending" }
  | { kind: "new"; tempId: string; name: string };

type SearchResult = { id: string; name: string; preferredName: string | null; linkStatus: "linked" | "pending" };

// fontSize must be >= 16px — anything smaller makes iOS Safari auto-zoom the
// page on focus and not reliably zoom back out on blur.
const compactInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 16,
  minHeight: 36,
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
};

// Shared by the Facilitators and Participants sections of Create Activity —
// search by name, filter by age category (either narrows the same result
// list), tick as many as needed rather than adding one at a time, and
// quick-add someone not yet in People. Nothing is written to the database
// here — selections just accumulate in local state until the page's final
// submit creates the activity and every enrollment together.
export function PeoplePicker({
  label,
  role,
  selected,
  onChange,
}: {
  label: string;
  role: "facilitator" | "participant";
  selected: PickedPerson[];
  onChange: (next: PickedPerson[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<SearchResult[]>([]);
  const ineligible = role === "facilitator" ? FACILITATOR_INELIGIBLE_CATEGORIES : PARTICIPANT_INELIGIBLE_CATEGORIES;
  const categoryOptions = CATEGORY_LABELS.filter((c) => !ineligible.includes(c));

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (query.trim().length < 2 && categoryFilter.size === 0) {
        setResults([]);
        return;
      }
      const rows = await searchPeopleForPicker(query, [...categoryFilter], role);
      if (!cancelled) setResults(rows);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [query, categoryFilter, role]);

  function toggleCategory(cat: string) {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const selectedIds = new Set(selected.filter((p): p is Extract<PickedPerson, { kind: "existing" }> => p.kind === "existing").map((p) => p.id));

  function toggleExisting(r: SearchResult) {
    if (selectedIds.has(r.id)) {
      onChange(selected.filter((p) => !(p.kind === "existing" && p.id === r.id)));
    } else {
      onChange([...selected, { kind: "existing", id: r.id, name: r.name, preferredName: r.preferredName, linkStatus: r.linkStatus }]);
    }
  }

  function addNew() {
    const trimmed = query.trim();
    if (!trimmed) return;
    onChange([...selected, { kind: "new", tempId: crypto.randomUUID(), name: trimmed }]);
    setQuery("");
  }

  function removeSelected(index: number) {
    onChange(selected.filter((_, i) => i !== index));
  }

  return (
    <div>
      <h4 style={{ fontSize: "0.85rem", color: "var(--text)", marginBottom: 8 }}>{label}</h4>
      <input
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={compactInputStyle}
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {categoryOptions.map((cat) => (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            style={{
              padding: "4px 10px",
              borderRadius: 12,
              border: `1px solid ${categoryFilter.has(cat) ? "var(--deep)" : "var(--border)"}`,
              background: categoryFilter.has(cat) ? "var(--deep)" : "var(--card-bg)",
              color: categoryFilter.has(cat) ? "var(--cream)" : "var(--muted)",
              fontSize: "0.7rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {formatCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {query.trim() && (
        <button
          onClick={addNew}
          style={{
            marginTop: 8,
            width: "100%",
            textAlign: "left",
            minHeight: 36,
            padding: "6px 10px",
            border: "1px dashed var(--gold)",
            borderRadius: "var(--radius-sm)",
            background: "var(--cream2)",
            color: "var(--warm)",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          + Add new: &ldquo;{query.trim()}&rdquo;
        </button>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 2, maxHeight: 200, overflowY: "auto" }}>
          {results.map((r) => (
            <label
              key={r.id}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", fontSize: "0.85rem", color: "var(--text)", cursor: "pointer" }}
            >
              <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleExisting(r)} />
              {formatFullName(r.name, r.preferredName)}
              {r.linkStatus === "pending" && <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>(not linked)</span>}
            </label>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selected.map((p, i) => (
            <span
              key={p.kind === "existing" ? p.id : p.tempId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 6px 3px 10px",
                borderRadius: "var(--radius-pill)",
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                fontSize: "0.78rem",
                color: "var(--text)",
              }}
            >
              {p.kind === "existing" ? formatFullName(p.name, p.preferredName) : `${p.name} (new)`}
              <button
                onClick={() => removeSelected(i)}
                aria-label="Remove"
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.85rem", padding: "0 2px" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
