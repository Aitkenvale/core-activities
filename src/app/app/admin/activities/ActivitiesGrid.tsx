"use client";

import { useMemo, useState } from "react";
import { updateActivity, bulkCreateEventsFromCadence } from "./actions";
import { getActivityForEdit, type ActivityForEdit, type ActivityStatus } from "@/app/app/activities/actions";
import { CreateActivityForm } from "@/app/app/activities/CreateActivityForm";
import { EnrolAttendeesModal } from "@/components/EnrolAttendeesModal";
import { StatusBadge } from "@/components/StatusPills";
import { ModalCloseButton } from "@/components/ModalCloseButton";

type Category = { id: string; label: string };
type Neighbourhood = { id: string; name: string };

type Row = {
  id: string;
  name: string;
  categoryId: string;
  neighbourhoodId: string;
  startDate: string | null;
  hidden: boolean;
  cadenceType: string;
  status: ActivityStatus;
};

type SortKey = "name" | "startDate";

// PSEC / JYSEP / SC / CAMP — the category's own internal code, uppercased,
// rather than the full label ("Junior Youth Group"), to keep filter rows
// narrow.
function categoryAbbrev(categoryId: string): string {
  return categoryId.toUpperCase();
}

// Same ROW_HEIGHT/margin as PeopleGrid and HouseholdsGrid — kept identical
// across all admin grids so rows visually match between them, not just
// internally consistent within one file. `height` on a table cell is only a
// minimum, not a cap — a native date input can still render taller than
// requested even with appearance:none, so this needs real headroom (not
// just 1-2px) to reliably win against browser quirks.
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

const COLUMN_WIDTHS = { startDate: 130, status: 110, addEvents: 160, addAttendees: 160 };

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
  const [showClosed, setShowClosed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [neighbourhoodFilter, setNeighbourhoodFilter] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [formModal, setFormModal] = useState<null | { mode: "create" } | { mode: "edit"; activity: ActivityForEdit }>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [eventsModalFor, setEventsModalFor] = useState<Row | null>(null);
  const [enrolModalFor, setEnrolModalFor] = useState<Row | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  function patchLocal(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function save(id: string, patch: { startDate: string | null }) {
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

  function toggleNeighbourhood(neighbourhoodId: string) {
    setNeighbourhoodFilter((prev) => {
      const next = new Set(prev);
      if (next.has(neighbourhoodId)) next.delete(neighbourhoodId);
      else next.add(neighbourhoodId);
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

  async function openEdit(row: Row) {
    setLoadingEditId(row.id);
    try {
      const activity = await getActivityForEdit(row.id);
      if (activity) setFormModal({ mode: "edit", activity });
    } finally {
      setLoadingEditId(null);
    }
  }

  const visibleRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    let filtered = showClosed ? rows : rows.filter((r) => !r.hidden);
    if (categoryFilter.size > 0) filtered = filtered.filter((r) => categoryFilter.has(r.categoryId));
    if (neighbourhoodFilter.size > 0) filtered = filtered.filter((r) => neighbourhoodFilter.has(r.neighbourhoodId));
    if (q) filtered = filtered.filter((r) => r.name.toLowerCase().includes(q));
    return [...filtered].sort((a, b) => {
      const av = sortKey === "startDate" ? (a.startDate ?? "") : a.name;
      const bv = sortKey === "startDate" ? (b.startDate ?? "") : b.name;
      const cmp = av.localeCompare(bv);
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, filterText, showClosed, categoryFilter, neighbourhoodFilter, sortKey, sortAsc]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      {/* paddingTop above matches this sticky header's own bottom padding
          (both var(--space-3)) so the gap above the title equals the gap
          below the search row. */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--page-bg)", padding: "0 9px var(--space-3)" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 12 }}>
          Edit Activities ({visibleRows.length})
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Search by name…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ ...inputStyle, width: 320, border: "1px solid var(--border)" }}
          />
          <Pill active={showClosed} onClick={() => setShowClosed((v) => !v)}>
            Ended
          </Pill>
          <CategoryDropdown categories={categories} selected={categoryFilter} onToggle={toggleCategory} />
          <NeighbourhoodDropdown neighbourhoods={neighbourhoods} selected={neighbourhoodFilter} onToggle={toggleNeighbourhood} />
          <button
            onClick={() => setFormModal({ mode: "create" })}
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
            display text and an input (that was the page "jitter"). Name has
            no fixed width set below, so it's the one column that absorbs
            whatever space is left over. */}
        <table
          style={{
            borderCollapse: "collapse",
            tableLayout: "fixed",
            width: "100%",
            minWidth: COLUMN_WIDTHS.startDate + COLUMN_WIDTHS.status + COLUMN_WIDTHS.addEvents + COLUMN_WIDTHS.addAttendees + 220,
            background: "var(--card-bg)",
          }}
        >
          <thead>
            <tr>
              {(
                [
                  { label: "Name", width: undefined, sortKey: "name" as const },
                  { label: "Start Date", width: COLUMN_WIDTHS.startDate, sortKey: "startDate" as const },
                  { label: "Status", width: COLUMN_WIDTHS.status, sortKey: null },
                  { label: "Add Events", width: COLUMN_WIDTHS.addEvents, sortKey: null },
                  { label: "Add attendees", width: COLUMN_WIDTHS.addAttendees, sortKey: null },
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
            {visibleRows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...cellStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => openEdit(r)}
                      disabled={loadingEditId === r.id}
                      aria-label={`Edit ${r.name}`}
                      style={{ flexShrink: 0, background: "none", border: "none", padding: 2, cursor: "pointer", color: "var(--muted)" }}
                    >
                      {loadingEditId === r.id ? "…" : <EditIcon />}
                    </button>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                  </div>
                </td>
                <TextCell
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
                  <StatusBadge value={r.status} />
                </td>
                <td style={cellStyle}>
                  <button
                    onClick={() => setEventsModalFor(r)}
                    disabled={r.cadenceType === "ad_hoc"}
                    title={r.cadenceType === "ad_hoc" ? "Ad-hoc activities have no cadence to generate dates from" : undefined}
                    style={{
                      ...inputStyle,
                      border: "1px solid var(--border)",
                      cursor: r.cadenceType === "ad_hoc" ? "default" : "pointer",
                      opacity: r.cadenceType === "ad_hoc" ? 0.5 : 1,
                    }}
                  >
                    Add events
                  </button>
                </td>
                <td style={cellStyle}>
                  <button
                    onClick={() => setEnrolModalFor(r)}
                    style={{ ...inputStyle, border: "1px solid var(--border)", cursor: "pointer" }}
                  >
                    Add attendees
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formModal && (
        <ModalShell title={formModal.mode === "edit" ? "Edit Activity" : "Add Activity"} onClose={() => setFormModal(null)}>
          <CreateActivityForm
            categories={categories}
            neighbourhoods={neighbourhoods}
            mode={formModal.mode}
            initial={formModal.mode === "edit" ? formModal.activity : undefined}
            isAdmin
            onCancel={() => setFormModal(null)}
            // Reloading rather than hand-patching local state — the modal
            // form can change fields this grid no longer displays (cadence,
            // roster, notes...), and a full reload is simpler and more
            // reliable than keeping every one of those in sync by hand.
            onSaved={() => window.location.reload()}
          />
        </ModalShell>
      )}

      {eventsModalFor && <AddEventsModal row={eventsModalFor} onClose={() => setEventsModalFor(null)} />}

      {enrolModalFor && (
        <EnrolAttendeesModal
          activityId={enrolModalFor.id}
          activityName={enrolModalFor.name}
          onClose={() => setEnrolModalFor(null)}
          onEnrolled={() => setEnrolModalFor(null)}
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

function NeighbourhoodDropdown({
  neighbourhoods,
  selected,
  onToggle,
}: {
  neighbourhoods: Neighbourhood[];
  selected: Set<string>;
  onToggle: (neighbourhoodId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = selected.size > 0;

  return (
    <div style={{ position: "relative" }}>
      <Pill active={active} onClick={() => setOpen((v) => !v)}>
        Neighbourhood{active ? ` (${selected.size})` : ""}
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
            {neighbourhoods.map((n) => (
              <label
                key={n.id}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: "0.8rem", color: "var(--text)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <input type="checkbox" checked={selected.has(n.id)} onChange={() => onToggle(n.id)} />
                {n.name}
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
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onDone();
        }}
        style={{ ...inputStyle, fontSize: "0.75rem" }}
      />
    </td>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-6)",
          width: "min(90vw, 480px)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <ModalCloseButton onClick={onClose} />
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", color: "var(--heading)", marginBottom: "var(--space-4)", paddingRight: 28 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function AddEventsModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const [firstDate, setFirstDate] = useState(row.startDate ?? "");
  const [lastDate, setLastDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const res = await bulkCreateEventsFromCadence(row.id, firstDate, lastDate);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create sessions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Add Events — ${row.name}`} onClose={onClose}>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <label style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          First date
          <input
            type="date"
            value={firstDate}
            onChange={(e) => setFirstDate(e.target.value)}
            disabled={!!result}
            style={{ ...inputStyle, border: "1px solid var(--border)", marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          Last date
          <input
            type="date"
            value={lastDate}
            onChange={(e) => setLastDate(e.target.value)}
            disabled={!!result}
            style={{ ...inputStyle, border: "1px solid var(--border)", marginTop: 4 }}
          />
        </label>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
          Creates a blank session for every date in this range matching the activity&rsquo;s cadence — ready to mark attendance for in Bulk Edit Attendance.
        </p>
        {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
        {result && (
          <p style={{ color: "var(--green)", fontSize: "0.85rem", margin: 0 }}>
            {result.created} session{result.created === 1 ? "" : "s"} created{result.skipped > 0 ? ` (${result.skipped} already existed)` : ""}.
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer", padding: "8px 12px" }}>
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleCreate}
              disabled={busy || !firstDate || !lastDate}
              style={{ background: "var(--deep)", color: "var(--cream)", border: "none", borderRadius: 2, padding: "8px 20px", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {busy ? "Creating…" : "Create Sessions"}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
