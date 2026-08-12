"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updatePerson,
  searchHouseholds,
  createHousehold,
  searchPeopleForContact,
  createContactPerson,
  saveHouseholdContact,
  createPerson,
  type PersonPatch,
} from "./actions";
import { getCategoryLabel, CATEGORY_LABELS, formatCategoryLabel } from "@/lib/category";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { PersonMergeDialog } from "./PersonMergeDialog";

// Infants can't be enrolled in anything — the Participants filter only ever
// needs Young Child through Adult.
const PARTICIPANT_CATEGORY_LABELS = CATEGORY_LABELS.slice(1);

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
  regoFormUrl: string | null;
  hidden: boolean;
  linkStatus: "linked" | "pending";
  comment: string | null;
  // Whether this person is set as some household's contact — if so, a
  // missing mobile number is essential info, not merely optional.
  isHouseholdContact: boolean;
  // Actively on an activity's roster as a participant (not a facilitator) in
  // a non-Complete activity — drives the Participants filter dropdown.
  isCurrentParticipant: boolean;
  // This person's own household's designated contact — prefills the
  // Household column's popup, same fields as the Attendance Add Info modal.
  householdContactPersonId: string | null;
  householdContactName: string | null;
  householdContactPreferredName: string | null;
  householdContactMobile: string | null;
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
  { key: "regoFormUrl", label: "Rego", width: 80 },
  { key: "hidden", label: "Hide", width: 70 },
  { key: "comment", label: "Comment", width: undefined },
];
const COMMENT_MIN_WIDTH = 180;
const CHECKBOX_COL_WIDTH = 36;
const MAX_MERGE_SELECTION = 3;

// Fixed row height so a cell never grows taller when it switches from
// display text to an input/select/date-input. `height` on a table cell is
// only a minimum, not a cap — a native <select>/date input can still render
// taller than requested even with appearance:none, so this needs real
// headroom (not just 1-2px) to reliably win against browser quirks and
// match Households/Activities, which have fewer native controls fighting it.
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
  // the browser's own larger minimum, stretching the whole row.
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

export function PeopleGrid({ initialRows, initialFilter = "" }: { initialRows: Row[]; initialFilter?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  // Seeded from ?q= — the Households grid's link icon jumps here with the
  // household name pre-filled so its members are immediately visible.
  const [filterText, setFilterText] = useState(initialFilter);
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [participantFilter, setParticipantFilter] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [noRegoOnly, setNoRegoOnly] = useState(false);
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // Only ever up to MAX_MERGE_SELECTION at a time — a further tap is
  // ignored rather than replacing an existing pick, so clearing one first
  // is a deliberate choice, not something that happens by accident.
  function toggleMergeSelect(id: string) {
    setSelectedForMerge((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_MERGE_SELECTION) next.add(id);
      return next;
    });
  }

  function toggleCategory(label: string) {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function toggleParticipant(label: string) {
    setParticipantFilter((prev) => {
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

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createPerson(name);
      setRows((rs) => [
        ...rs,
        {
          id: created.id,
          name,
          preferredName: null,
          householdId: null,
          householdName: null,
          dob: null,
          mobile: null,
          email: null,
          regoYear: null,
          regoFormUrl: null,
          hidden: false,
          linkStatus: "linked",
          comment: null,
          isHouseholdContact: false,
          isCurrentParticipant: false,
          householdContactPersonId: null,
          householdContactName: null,
          householdContactPreferredName: null,
          householdContactMobile: null,
        },
      ]);
      setNewName("");
    } catch (e) {
      console.error("Create failed:", e);
    } finally {
      setCreating(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function sortValue(r: Row, key: SortKey): string {
    if (key === "category") return getCategoryLabel(r.dob) ?? "";
    const v = r[key];
    return v === null || v === undefined ? "" : String(v);
  }

  const visibleRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    let filtered = showHidden ? rows : rows.filter((r) => !r.hidden);
    if (noRegoOnly) {
      // A linked form is the real signal — a recorded rego year with no
      // form yet still counts as "on file" (a backup), so this only flags
      // people with neither.
      filtered = filtered.filter((r) => r.regoFormUrl === null && r.regoYear === null);
    }
    if (categoryFilter.size > 0) {
      filtered = filtered.filter((r) => categoryFilter.has(getCategoryLabel(r.dob) ?? ""));
    }
    if (participantFilter.size > 0) {
      filtered = filtered.filter((r) => r.isCurrentParticipant && participantFilter.has(getCategoryLabel(r.dob) ?? ""));
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
  }, [rows, filterText, categoryFilter, participantFilter, showHidden, noRegoOnly, sortKey, sortAsc]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      {/* 9px = the table's 1px border + its cells' 8px left padding, so the
          title/search line up with the actual text in the rows below.
          paddingTop above matches this sticky header's own bottom padding
          (both var(--space-3)) so the gap above the title equals the gap
          below the search row. */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--page-bg)", padding: "0 9px var(--space-3)" }}>
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
          <CategoryDropdown label="Category" options={CATEGORY_LABELS} selected={categoryFilter} onToggle={toggleCategory} />
          <CategoryDropdown label="Participants" options={PARTICIPANT_CATEGORY_LABELS} selected={participantFilter} onToggle={toggleParticipant} />
          <button
            onClick={() => setShowMergeDialog(true)}
            disabled={selectedForMerge.size < 2}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
              color: selectedForMerge.size >= 2 ? "var(--text)" : "var(--border)",
              fontSize: "0.75rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: selectedForMerge.size >= 2 ? "pointer" : "default",
              whiteSpace: "nowrap",
            }}
          >
            Merge{selectedForMerge.size > 0 ? ` (${selectedForMerge.size}/${MAX_MERGE_SELECTION})` : ""}
          </button>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <input
              placeholder="New person name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              style={{ ...inputStyle, width: 200, border: "1px solid var(--border)" }}
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
            minWidth: CHECKBOX_COL_WIDTH + COLUMNS.reduce((sum, c) => sum + (c.width ?? COMMENT_MIN_WIDTH), 0),
            background: "var(--card-bg)",
          }}
        >
          <thead>
            <tr>
              <th style={{ ...cellStyle, width: CHECKBOX_COL_WIDTH, background: "var(--table-header-bg)" }} />
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
                <td style={{ ...cellStyle, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedForMerge.has(r.id)}
                    onChange={() => toggleMergeSelect(r.id)}
                    disabled={!selectedForMerge.has(r.id) && selectedForMerge.size >= MAX_MERGE_SELECTION}
                  />
                </td>
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
                  onSave={(
                    householdId,
                    householdName,
                    householdContactPersonId,
                    householdContactName,
                    householdContactPreferredName,
                    householdContactMobile,
                  ) => {
                    patchLocal(r.id, {
                      householdId,
                      householdName,
                      householdContactPersonId,
                      householdContactName,
                      householdContactPreferredName,
                      householdContactMobile,
                    });
                  }}
                />
                <TextCell
                  type="date"
                  value={r.dob}
                  emptyLabel="Add Info"
                  onSave={(v) => {
                    patchLocal(r.id, { dob: v || null });
                    save(r.id, { dob: v || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "dob"}
                  onEdit={() => setEditing({ id: r.id, field: "dob" })}
                  onDone={() => setEditing(null)}
                />
                {/* Computed live from DOB (matches the old sheet's LOOKUP formula) — not stored, not editable, so it never goes stale as someone ages. */}
                <td style={cellStyle}>
                  {getCategoryLabel(r.dob) ? formatCategoryLabel(getCategoryLabel(r.dob)!) : <span style={{ color: "var(--border)" }}>—</span>}
                </td>
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
                  copyable
                  emptyLabel={r.isHouseholdContact ? "Add Info" : undefined}
                  onSave={(v) => {
                    patchLocal(r.id, { mobile: v || null });
                    save(r.id, { mobile: v || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "mobile"}
                  onEdit={() => setEditing({ id: r.id, field: "mobile" })}
                  onDone={() => setEditing(null)}
                />
                <RegoFormCell
                  value={r.regoFormUrl}
                  onSave={(v) => {
                    patchLocal(r.id, { regoFormUrl: v.trim() || null });
                    save(r.id, { regoFormUrl: v.trim() || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "regoFormUrl"}
                  onEdit={() => setEditing({ id: r.id, field: "regoFormUrl" })}
                  onDone={() => setEditing(null)}
                />
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

      {showMergeDialog && selectedForMerge.size >= 2 && (
        <PersonMergeDialog
          candidates={rows.filter((r) => selectedForMerge.has(r.id))}
          onClose={() => setShowMergeDialog(false)}
          onMerged={() => window.location.reload()}
        />
      )}
    </div>
  );
}

// Shared by the Category and Participants filters — same checkbox-list
// dropdown, just a different label and set of category options.
function CategoryDropdown({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = selected.size > 0;

  return (
    <div style={{ position: "relative" }}>
      <Pill active={active} onClick={() => setOpen((v) => !v)}>
        {label}{active ? ` (${selected.size})` : ""}
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
            {options.map((option) => (
              <label
                key={option}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: "0.8rem", color: "var(--text)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <input type="checkbox" checked={selected.has(option)} onChange={() => onToggle(option)} />
                {formatCategoryLabel(option)}
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

// Shared by the mobile column's copy button and the household column's
// link button — sits to the left of the cell's display text, only when
// not editing, so it never collides with the click-to-edit target.
const iconButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  padding: 0,
  border: "none",
  background: "none",
  color: "var(--muted)",
  cursor: "pointer",
};

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// A chain link — distinct from the copy icon, since this navigates to
// another record rather than copying this cell's value.
function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <path d="M8 12h8" />
    </svg>
  );
}

function TextCell({
  value,
  onSave,
  editing,
  onEdit,
  onDone,
  type = "text",
  copyable = false,
  emptyLabel,
}: {
  value: string | null;
  onSave: (v: string) => void;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  type?: "text" | "date";
  copyable?: boolean;
  // Shown instead of a plain "—" when this field is essential and missing —
  // names exactly what the system is waiting for, at the field itself
  // rather than a separate summary column.
  emptyLabel?: string;
}) {
  const [draft, setDraft] = useState(value || "");
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  if (!editing) {
    return (
      <td style={{ ...cellStyle, cursor: "pointer" }} onClick={onEdit}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {copyable && value && (
            <button onClick={handleCopy} title="Copy" style={iconButtonStyle}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {value ? (
              value
            ) : emptyLabel ? (
              <span style={{ color: "var(--heading)", textDecoration: "underline" }}>{emptyLabel}</span>
            ) : (
              <span style={{ color: "var(--border)" }}>—</span>
            )}
          </span>
        </span>
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

// "Link" (paste a URL to the person's scanned registration form) when
// nothing's set, "View" (opens it in a new tab) once it is — a plain URL
// field rather than a real upload for now, so a form hosted anywhere
// (Vercel Blob, a shared drive, wherever) can be linked the same way.
function RegoFormCell({ value, onSave, editing, onEdit, onDone }: { value: string | null; onSave: (v: string) => void; editing: boolean; onEdit: () => void; onDone: () => void }) {
  const [draft, setDraft] = useState(value || "");

  if (editing) {
    function commit() {
      onSave(draft);
      onDone();
    }
    return (
      <td style={cellStyle}>
        <input
          autoFocus
          type="url"
          placeholder="Paste form URL…"
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

  return (
    <td style={cellStyle}>
      {value ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {/* Routed through our own proxy, not the raw blob URL — the store
              is private (requires a token to read), so the API route below
              streams the file back after checking for an admin session. */}
          <a
            href={`/api/admin/rego-form?url=${encodeURIComponent(value)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--heading)", textDecoration: "underline" }}
          >
            View
          </a>
          <button
            onClick={onEdit}
            title="Change link"
            style={{ ...iconButtonStyle, color: "var(--muted)" }}
          >
            <PencilIcon />
          </button>
        </span>
      ) : (
        <button onClick={onEdit} style={{ background: "none", border: "none", padding: 0, color: "var(--heading)", textDecoration: "underline", fontSize: "0.85rem", cursor: "pointer" }}>
          Link
        </button>
      )}
    </td>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// Opens the same Add Info-style popup used on the Attendance roster —
// Household, Contact and the contact's Mobile in one modal — instead of the
// old inline dropdown, so setting someone's household looks and behaves the
// same wherever it comes up.
function HouseholdCell({
  row,
  onSave,
}: {
  row: Row;
  onSave: (
    householdId: string | null,
    householdName: string | null,
    householdContactPersonId: string | null,
    householdContactName: string | null,
    householdContactPreferredName: string | null,
    householdContactMobile: string | null,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <td style={{ ...cellStyle, cursor: "pointer" }} onClick={() => setOpen(true)}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {row.householdName && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/app/admin/households?q=${encodeURIComponent(row.householdName!)}`);
            }}
            title="Open in Edit Households"
            style={iconButtonStyle}
          >
            <LinkIcon />
          </button>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {row.householdName || <span style={{ color: "var(--heading)", textDecoration: "underline" }}>Add Info</span>}
        </span>
      </span>
      {open && (
        <PersonHouseholdModal
          row={row}
          onClose={() => setOpen(false)}
          onSaved={(...args) => {
            onSave(...args);
            setOpen(false);
          }}
        />
      )}
    </td>
  );
}

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "0.85rem",
  minHeight: 36,
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
};

// Flags a field that's essential to this person's completeness and still empty.
const missingBorderStyle: React.CSSProperties = { border: "1px solid var(--red)" };

// How long to wait after the last change before auto-saving.
const AUTOSAVE_DELAY_MS = 700;

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
      {children}
    </label>
  );
}

// Same Household + Contact + Mobile trio as the Attendance Add Info modal.
function PersonHouseholdModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: (
    householdId: string | null,
    householdName: string | null,
    householdContactPersonId: string | null,
    householdContactName: string | null,
    householdContactPreferredName: string | null,
    householdContactMobile: string | null,
  ) => void;
}) {
  const [householdId, setHouseholdId] = useState(row.householdId);
  const [householdQuery, setHouseholdQuery] = useState(row.householdName ?? "");
  const [householdResults, setHouseholdResults] = useState<{ id: string; name: string }[]>([]);
  const [contactPersonId, setContactPersonId] = useState(row.householdContactPersonId);
  const [contactQuery, setContactQuery] = useState(row.householdContactPreferredName || row.householdContactName || "");
  const [contactResults, setContactResults] = useState<{ id: string; name: string; preferredName: string | null; mobile: string | null }[]>([]);
  const [contactMobile, setContactMobile] = useState(row.householdContactMobile ?? "");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Frozen snapshot of every field as this modal opened — used both to diff
  // "did this actually change" for auto-save, and by Cancel to revert.
  const originalRef = useRef(row);
  // A newly selected/created household's real contact isn't known
  // client-side — this tracks the right baseline to diff the Contact
  // fields against once the household has changed from the person's
  // original one (see persist() below).
  const householdBaselineRef = useRef({
    householdId: row.householdId,
    contactPersonId: row.householdContactPersonId,
    contactMobile: row.householdContactMobile ?? "",
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleHouseholdSearch(value: string) {
    setHouseholdQuery(value);
    setHouseholdId(null);
    setHouseholdResults(await searchHouseholds(value));
  }

  async function handleCreateHousehold() {
    const trimmed = householdQuery.trim();
    if (!trimmed) return;
    try {
      const created = await createHousehold(trimmed);
      setHouseholdId(created.id);
      setHouseholdQuery(created.name);
      setHouseholdResults([]);
      householdBaselineRef.current = { householdId: created.id, contactPersonId: null, contactMobile: "" };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that household.");
    }
  }

  function handleRemoveHousehold() {
    setHouseholdId(null);
    setHouseholdQuery("");
    setHouseholdResults([]);
    setContactPersonId(null);
    setContactQuery("");
    setContactResults([]);
    setContactMobile("");
    householdBaselineRef.current = { householdId: null, contactPersonId: null, contactMobile: "" };
  }

  async function handleContactSearch(value: string) {
    setContactQuery(value);
    setContactPersonId(null);
    setContactResults(await searchPeopleForContact(value));
  }

  function selectContact(p: { id: string; name: string; preferredName: string | null; mobile: string | null }) {
    setContactPersonId(p.id);
    setContactQuery(p.preferredName || p.name);
    setContactResults([]);
    setContactMobile(p.mobile ?? "");
  }

  function handleRemoveContact() {
    setContactPersonId(null);
    setContactQuery("");
    setContactResults([]);
    setContactMobile("");
  }

  async function handleCreateContact() {
    const trimmed = contactQuery.trim();
    if (!trimmed) return;
    try {
      const created = await createContactPerson(trimmed);
      setContactPersonId(created.id);
      setContactQuery(created.preferredName || created.name);
      setContactResults([]);
      setContactMobile(""); // a brand-new person has no mobile yet
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that contact.");
    }
  }

  // The auto-save itself — diffs current state against the frozen original
  // and only sends what actually changed.
  async function persist() {
    setSaving(true);
    setError(null);
    try {
      let finalHouseholdId = householdId;
      // No household yet, but a contact was picked anyway — a contact
      // doesn't require a household to already exist, so create a bare one
      // now (named after this person). Can be renamed/merged properly later
      // in Edit Households.
      if (!finalHouseholdId && contactPersonId) {
        const created = await createHousehold(`${row.name} household`);
        finalHouseholdId = created.id;
        setHouseholdId(created.id);
        setHouseholdQuery(created.name);
        householdBaselineRef.current = { householdId: created.id, contactPersonId: null, contactMobile: "" };
      }

      const tasks: Promise<unknown>[] = [];
      if (finalHouseholdId !== originalRef.current.householdId) tasks.push(updatePerson(row.id, { householdId: finalHouseholdId }));

      const onOriginalHousehold = finalHouseholdId === originalRef.current.householdId;
      const contactIdBaseline = onOriginalHousehold ? originalRef.current.householdContactPersonId : householdBaselineRef.current.contactPersonId;
      const contactMobileBaseline = onOriginalHousehold ? (originalRef.current.householdContactMobile ?? "") : householdBaselineRef.current.contactMobile;
      if (finalHouseholdId && (contactPersonId !== contactIdBaseline || contactMobile !== contactMobileBaseline)) {
        tasks.push(saveHouseholdContact(finalHouseholdId, contactPersonId, contactMobile || null));
      }
      if (tasks.length === 0) return;
      await Promise.all(tasks);
      onSaved(
        finalHouseholdId,
        finalHouseholdId ? householdQuery : null,
        contactPersonId,
        contactPersonId ? contactQuery : null,
        null,
        contactPersonId ? contactMobile || null : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    saveTimer.current = setTimeout(() => {
      persist();
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, contactPersonId, contactMobile]);

  // The relabeled former Save button — auto-save already did the work, this
  // just flushes anything still mid-debounce and closes.
  async function handleFinish() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await persist();
    onClose();
  }

  // Undoes whatever auto-save already persisted for this person and their
  // *original* household's contact this session, then closes. A household
  // auto-created along the way (see persist() above) is left in place
  // rather than deleted — it's a real, independent household record, not
  // something scoped to undo.
  async function handleCancel() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setCancelling(true);
    try {
      await updatePerson(row.id, { householdId: originalRef.current.householdId });
      if (originalRef.current.householdId) {
        await saveHouseholdContact(originalRef.current.householdId, originalRef.current.householdContactPersonId, originalRef.current.householdContactMobile ?? null);
      }
      onSaved(
        originalRef.current.householdId,
        originalRef.current.householdName,
        originalRef.current.householdContactPersonId,
        originalRef.current.householdContactName,
        originalRef.current.householdContactPreferredName,
        originalRef.current.householdContactMobile,
      );
    } catch {
      // Best-effort revert — still close either way.
    } finally {
      setCancelling(false);
    }
    onClose();
  }

  return (
    <>
      {/* Tapping outside closes without discarding — auto-save already ran,
          so this behaves like the "Auto-Save" button, not Cancel. */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleFinish();
        }}
        style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.65)" }}
      />
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 91,
          width: "min(90vw, 340px)",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={handleFinish} />
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "var(--heading)", marginBottom: "var(--space-4)", paddingRight: 28 }}>
          Household
        </h3>

        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <ModalField label="Household">
            <input
              placeholder="Search household…"
              value={householdQuery}
              onChange={(e) => handleHouseholdSearch(e.target.value)}
              style={{ ...modalInputStyle, ...(!householdId ? missingBorderStyle : {}) }}
            />
            {householdQuery.trim() && householdId === null && (
              <button
                onClick={handleCreateHousehold}
                style={{
                  marginTop: 4,
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  border: "1px dashed var(--gold)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--cream2)",
                  color: "var(--warm)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                + Create new household: &ldquo;{householdQuery.trim()}&rdquo;
              </button>
            )}
            {householdResults.length > 0 && (
              <div style={{ marginTop: 4, display: "grid", gap: 2, maxHeight: 120, overflowY: "auto" }}>
                {householdResults.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setHouseholdId(h.id);
                      setHouseholdQuery(h.name);
                      setHouseholdResults([]);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "4px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--card-bg)",
                      color: "var(--text)",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
            {(householdId || householdQuery.trim()) && (
              <button
                onClick={handleRemoveHousehold}
                style={{ marginTop: 4, textAlign: "left", padding: 0, border: "none", background: "none", color: "var(--red)", fontSize: "0.75rem", cursor: "pointer" }}
              >
                Remove household
              </button>
            )}
          </ModalField>
          <ModalField label="Contact">
            <input
              placeholder="Search contact…"
              value={contactQuery}
              onChange={(e) => handleContactSearch(e.target.value)}
              style={{ ...modalInputStyle, ...(!contactPersonId ? missingBorderStyle : {}) }}
            />
            {contactQuery.trim() && contactPersonId === null && (
              <button
                onClick={handleCreateContact}
                style={{
                  marginTop: 4,
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  border: "1px dashed var(--gold)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--cream2)",
                  color: "var(--warm)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                + Create new contact: &ldquo;{contactQuery.trim()}&rdquo;
              </button>
            )}
            {contactResults.length > 0 && (
              <div style={{ marginTop: 4, display: "grid", gap: 2, maxHeight: 120, overflowY: "auto" }}>
                {contactResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectContact(p)}
                    style={{
                      textAlign: "left",
                      padding: "4px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--card-bg)",
                      color: "var(--text)",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    {p.preferredName ? `${p.name} (${p.preferredName})` : p.name}
                  </button>
                ))}
              </div>
            )}
            {(contactPersonId || contactQuery.trim()) && (
              <button
                onClick={handleRemoveContact}
                style={{ marginTop: 4, textAlign: "left", padding: 0, border: "none", background: "none", color: "var(--red)", fontSize: "0.75rem", cursor: "pointer" }}
              >
                Remove contact
              </button>
            )}
          </ModalField>
          <ModalField label="Mobile">
            <input
              type="tel"
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
              disabled={!contactPersonId}
              placeholder={contactPersonId ? undefined : "Pick a contact first"}
              style={{ ...modalInputStyle, opacity: contactPersonId ? 1 : 0.6, ...(contactPersonId && !contactMobile ? missingBorderStyle : {}) }}
            />
          </ModalField>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: "var(--space-4)" }}>
          <button
            onClick={handleFinish}
            disabled={saving || cancelling}
            style={{ minHeight: 36, padding: "0 20px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--deep)", color: "var(--cream)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {saving ? "Saving…" : "Auto-Save"}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving || cancelling}
            style={{ minHeight: 36, padding: "0 20px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {cancelling ? "Undoing…" : "Cancel"}
          </button>
        </div>
        {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 8 }}>{error}</p>}
      </div>
    </>
  );
}
