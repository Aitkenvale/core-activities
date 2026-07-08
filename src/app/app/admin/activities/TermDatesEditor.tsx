"use client";

import { useState } from "react";
import { createTermDate, updateTermDate } from "./actions";

type TermRow = { id: string; year: number; termNumber: number; startDate: string; endDate: string };

// Fixed row height so a cell doesn't grow taller when it switches from
// display text to an input — native date inputs in particular render taller
// than a plain text input unless explicitly constrained, which was causing
// the row to visibly jitter.
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
  border: "1px solid var(--border)",
  borderRadius: 2,
  background: "var(--card-bg)",
  color: "var(--text)",
};

// Small, bundled here rather than a separate admin section — school-term
// cadence activities depend on this staying current, so adding next year's
// terms should be a quick in-app task, not a SQL chore once a year.
export function TermDatesEditor({ initialTerms }: { initialTerms: TermRow[] }) {
  const [terms, setTerms] = useState(initialTerms);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ year: new Date().getFullYear() + 1, termNumber: 1, startDate: "", endDate: "" });

  function patchLocal(id: string, patch: Partial<TermRow>) {
    setTerms((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function save(id: string, patch: Partial<Omit<TermRow, "id">>) {
    updateTermDate(id, patch).catch((e) => console.error("Save failed:", e));
  }

  async function handleAdd() {
    if (!draft.startDate || !draft.endDate) return;
    const created = await createTermDate(draft);
    setTerms((ts) => [...ts, created].sort((a, b) => a.year - b.year || a.termNumber - b.termNumber));
    setAdding(false);
    setDraft({ year: draft.year, termNumber: draft.termNumber + 1, startDate: "", endDate: "" });
  }

  return (
    <div style={{ maxWidth: 1400, margin: "var(--space-7) auto 0", padding: "0 9px" }}>
      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.15rem", color: "var(--heading)", marginBottom: 12 }}>
        Term Dates
      </h3>
      <div style={{ overflow: "hidden", overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
        {/* width:100% + minWidth, same reasoning as ActivitiesGrid — fills a
            wide container instead of leaving empty space, but won't shrink
            below a usable size on a narrow screen (scrolls instead). */}
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: 520, background: "var(--card-bg)" }}>
          <thead>
            <tr>
              {[
                { label: "Year", width: 90 },
                { label: "Term", width: 90 },
                { label: "Start", width: 170 },
                { label: "End", width: 170 },
              ].map((col) => (
                <th key={col.label} style={{ ...cellStyle, textAlign: "left", background: "var(--table-header-bg)", fontWeight: 500, width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <NumberCell value={t.year} onSave={(v) => { patchLocal(t.id, { year: v }); save(t.id, { year: v }); }} />
                <NumberCell value={t.termNumber} onSave={(v) => { patchLocal(t.id, { termNumber: v }); save(t.id, { termNumber: v }); }} />
                <DateCell value={t.startDate} onSave={(v) => { patchLocal(t.id, { startDate: v }); save(t.id, { startDate: v }); }} />
                <DateCell value={t.endDate} onSave={(v) => { patchLocal(t.id, { endDate: v }); save(t.id, { endDate: v }); }} />
              </tr>
            ))}
            {adding ? (
              <tr>
                <td style={cellStyle}>
                  <input type="number" value={draft.year} onChange={(e) => setDraft((d) => ({ ...d, year: parseInt(e.target.value, 10) || d.year }))} style={inputStyle} />
                </td>
                <td style={cellStyle}>
                  <input type="number" value={draft.termNumber} onChange={(e) => setDraft((d) => ({ ...d, termNumber: parseInt(e.target.value, 10) || d.termNumber }))} style={inputStyle} />
                </td>
                <td style={cellStyle}>
                  <input type="date" value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} style={inputStyle} />
                </td>
                <td style={cellStyle}>
                  <input type="date" value={draft.endDate} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))} style={inputStyle} />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {adding ? (
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={handleAdd} style={{ background: "var(--deep)", color: "var(--cream)", border: "none", borderRadius: 2, padding: "6px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
            Save Term
          </button>
          <button onClick={() => setAdding(false)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.8rem", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{ marginTop: 8, background: "none", border: "1px dashed var(--border)", borderRadius: 2, padding: "6px 14px", fontSize: "0.8rem", color: "var(--warm)", cursor: "pointer" }}
        >
          + Add Term
        </button>
      )}
    </div>
  );
}

function NumberCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (!editing) {
    return (
      <td style={cellStyle} onClick={() => setEditing(true)}>
        {value}
      </td>
    );
  }

  function commit() {
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) onSave(n);
    setEditing(false);
  }

  return (
    <td style={cellStyle}>
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        style={inputStyle}
      />
    </td>
  );
}

function DateCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <td style={cellStyle} onClick={() => setEditing(true)}>
        {value}
      </td>
    );
  }

  function commit() {
    if (draft) onSave(draft);
    setEditing(false);
  }

  return (
    <td style={cellStyle}>
      <input
        autoFocus
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        style={inputStyle}
      />
    </td>
  );
}
