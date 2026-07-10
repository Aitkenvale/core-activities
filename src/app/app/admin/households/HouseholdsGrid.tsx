"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateHousehold,
  createHousehold,
  searchPeopleForContact,
  createContactPerson,
  saveHouseholdContact,
  mergeHouseholds,
  type HouseholdPatch,
} from "./actions";

type Row = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  hidden: boolean;
  peopleCount: number;
  contactPersonId: string | null;
  contactName: string | null;
  contactPreferredName: string | null;
  contactMobile: string | null;
};

type SortKey = keyof Row | "contact";

// Every column except Notes gets a genuinely fixed width — Notes is left
// with no width set below, so (with table-layout:fixed + table width:100%)
// it's the only column that absorbs whatever space is left over, instead of
// every column stretching proportionally on a wide screen.
const COLUMNS: { key: SortKey; label: string; width: number | undefined; align?: "left" | "center" }[] = [
  { key: "name", label: "Name", width: 200 },
  { key: "address", label: "Address", width: 260 },
  { key: "contact", label: "Contact", width: 180 },
  { key: "peopleCount", label: "People", width: 70, align: "center" },
  { key: "hidden", label: "Hide", width: 70, align: "center" },
  { key: "notes", label: "Notes", width: undefined },
];
const NOTES_MIN_WIDTH = 220;
const CHECKBOX_COL_WIDTH = 36;

// Same ROW_HEIGHT/margin as PeopleGrid and ActivitiesGrid — kept identical
// across all three admin grids so rows visually match between them, not
// just internally consistent within one file.
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
};

// Same as PeopleGrid's household link icon — sits to the left of the Name
// column's display text, only when not editing.
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

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function HouseholdsGrid({ initialRows, initialFilter = "" }: { initialRows: Row[]; initialFilter?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  // Seeded from ?q= — the People grid's household link icon jumps here with
  // the household name pre-filled so the linked record is immediately visible.
  const [filterText, setFilterText] = useState(initialFilter);
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);

  function patchLocal(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // Only ever two at a time — a third tap is ignored rather than replacing
  // one of the existing picks, so the admin has to deliberately uncheck one
  // first instead of silently losing their first selection.
  function toggleMergeSelect(id: string) {
    setSelectedForMerge((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id);
      return next;
    });
  }

  async function handleMergeConfirm(primaryId: string, secondaryId: string) {
    const primary = rows.find((r) => r.id === primaryId);
    const secondary = rows.find((r) => r.id === secondaryId);
    if (!primary || !secondary) return;
    await mergeHouseholds(primaryId, secondaryId);
    patchLocal(primaryId, {
      peopleCount: primary.peopleCount + secondary.peopleCount,
      contactPersonId: primary.contactPersonId ?? secondary.contactPersonId,
      contactName: primary.contactPersonId ? primary.contactName : secondary.contactName,
      contactPreferredName: primary.contactPersonId ? primary.contactPreferredName : secondary.contactPreferredName,
    });
    patchLocal(secondaryId, { hidden: true, peopleCount: 0 });
    setSelectedForMerge(new Set());
    setShowMergeModal(false);
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
    if (key === "contact") return r.contactPreferredName || r.contactName || "";
    const v = r[key];
    return v === null || v === undefined ? "" : String(v);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createHousehold(name);
      setRows((rs) => [
        ...rs,
        { id: created.id, name: created.name, address: null, notes: null, hidden: false, peopleCount: 0, contactPersonId: null, contactName: null, contactPreferredName: null, contactMobile: null },
      ]);
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
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingTop: "var(--space-3)", paddingBottom: 24 }}>
      {/* 9px = the table's 1px border + its cells' 8px left padding, so the
          title/search line up with the actual text in the rows below.
          paddingTop above matches this sticky header's own bottom padding
          (both var(--space-3)) so the gap above the title equals the gap
          below the search row. */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--page-bg)", padding: "0 9px var(--space-3)" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 12 }}>
          Edit Households ({visibleRows.length})
        </h2>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
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
                background: showHidden ? "var(--deep)" : "var(--card-bg)",
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
            <button
              onClick={() => setShowMergeModal(true)}
              disabled={selectedForMerge.size !== 2}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "1px solid var(--border)",
                background: "var(--card-bg)",
                color: selectedForMerge.size === 2 ? "var(--text)" : "var(--border)",
                fontSize: "0.75rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: selectedForMerge.size === 2 ? "pointer" : "default",
                whiteSpace: "nowrap",
              }}
            >
              Merge{selectedForMerge.size > 0 ? ` (${selectedForMerge.size}/2)` : ""}
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
      </div>

      <div style={{ overflow: "hidden", overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
        {/* width:100% + minWidth (not a fixed width) — stretches to fill a
            wide desktop container (no empty space after Notes), but won't
            shrink columns below a usable size on a narrow screen (the
            wrapper scrolls horizontally instead). table-layout:fixed keeps
            every other column from resizing when a cell switches between
            display text and an input (that was the page "jitter"). */}
        <table
          style={{
            borderCollapse: "collapse",
            tableLayout: "fixed",
            width: "100%",
            minWidth: CHECKBOX_COL_WIDTH + COLUMNS.reduce((sum, c) => sum + (c.width ?? NOTES_MIN_WIDTH), 0),
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
                    textAlign: col.align ?? "left",
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
                    disabled={!selectedForMerge.has(r.id) && selectedForMerge.size >= 2}
                  />
                </td>
                <TextCell
                  value={r.name}
                  linkHref={`/app/admin/people?q=${encodeURIComponent(r.name)}`}
                  linkTitle="Open in Edit People"
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
                  emptyLabel="Add Info"
                  onSave={(v) => {
                    patchLocal(r.id, { address: v || null });
                    save(r.id, { address: v || null });
                  }}
                  editing={editing?.id === r.id && editing.field === "address"}
                  onEdit={() => setEditing({ id: r.id, field: "address" })}
                  onDone={() => setEditing(null)}
                />
                <ContactCell
                  row={r}
                  onSave={(contactPersonId, contactName, contactPreferredName, contactMobile) => {
                    patchLocal(r.id, { contactPersonId, contactName, contactPreferredName, contactMobile });
                  }}
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
      {showMergeModal && selectedForMerge.size === 2 && (
        <MergeConfirmModal
          households={rows.filter((r) => selectedForMerge.has(r.id))}
          onCancel={() => setShowMergeModal(false)}
          onConfirm={handleMergeConfirm}
        />
      )}
    </div>
  );
}

function MergeConfirmModal({
  households,
  onCancel,
  onConfirm,
}: {
  households: Row[];
  onCancel: () => void;
  onConfirm: (primaryId: string, secondaryId: string) => Promise<void>;
}) {
  const [primaryId, setPrimaryId] = useState(households[0].id);
  const [merging, setMerging] = useState(false);
  const secondary = households.find((h) => h.id !== primaryId);

  async function handleMerge() {
    if (!secondary) return;
    setMerging(true);
    await onConfirm(primaryId, secondary.id);
    setMerging(false);
  }

  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.4)" }} />
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 91,
          width: "min(90vw, 340px)",
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-5)",
        }}
      >
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "var(--heading)", marginBottom: "var(--space-3)" }}>
          Merge Households
        </h3>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "var(--space-4)" }}>
          Which household should be kept? Everyone from the other household will move into it, and the other household will be hidden.
        </p>
        <div style={{ display: "grid", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          {households.map((h) => (
            <label key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text)", cursor: "pointer" }}>
              <input type="radio" name="primary-household" checked={primaryId === h.id} onChange={() => setPrimaryId(h.id)} />
              {h.name}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleMerge}
            disabled={merging}
            style={{ minHeight: 36, padding: "0 20px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--deep)", color: "var(--cream)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {merging ? "Merging…" : "Merge"}
          </button>
          <button
            onClick={onCancel}
            style={{ minHeight: 36, padding: "0 20px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

function TextCell({
  value,
  onSave,
  editing,
  onEdit,
  onDone,
  linkHref,
  linkTitle,
  emptyLabel,
}: {
  value: string | null;
  onSave: (v: string) => void;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  // Optional leading link icon (Name column only) — navigates instead of
  // editing, so it needs its own click handler with stopPropagation.
  linkHref?: string;
  linkTitle?: string;
  // Shown instead of a plain "—" when this field is essential and missing.
  emptyLabel?: string;
}) {
  const [draft, setDraft] = useState(value || "");
  const router = useRouter();

  if (!editing) {
    return (
      <td style={{ ...cellStyle, cursor: "pointer" }} onClick={onEdit}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {linkHref && value && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(linkHref);
              }}
              title={linkTitle}
              style={iconButtonStyle}
            >
              <LinkIcon />
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

// Opens the same Add Info-style popup used on the Attendance roster —
// search-or-create a contact plus their mobile in one modal — instead of the
// old inline dropdown, so editing a household's contact looks and behaves
// the same wherever it comes up.
function ContactCell({
  row,
  onSave,
}: {
  row: Row;
  onSave: (contactPersonId: string | null, contactName: string | null, contactPreferredName: string | null, contactMobile: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const displayName = row.contactPreferredName || row.contactName;

  return (
    <td style={{ ...cellStyle, cursor: "pointer" }} onClick={() => setOpen(true)}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {displayName && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/app/admin/people?q=${encodeURIComponent(row.contactName!)}`);
            }}
            title="Open in Edit People"
            style={iconButtonStyle}
          >
            <LinkIcon />
          </button>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {displayName || <span style={{ color: "var(--heading)", textDecoration: "underline" }}>Add Info</span>}
        </span>
      </span>
      {open && (
        <HouseholdContactModal
          row={row}
          onClose={() => setOpen(false)}
          onSaved={(contactPersonId, contactName, contactPreferredName, contactMobile) => {
            onSave(contactPersonId, contactName, contactPreferredName, contactMobile);
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

// Flags a field that's essential to household completeness and still empty.
const missingBorderStyle: React.CSSProperties = { border: "1px solid var(--red)" };

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
      {children}
    </label>
  );
}

// Same Contact + Mobile pair as the Attendance Add Info modal, just scoped
// to an already-known household instead of a person's roster row.
function HouseholdContactModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: (contactPersonId: string | null, contactName: string | null, contactPreferredName: string | null, contactMobile: string | null) => void;
}) {
  const [contactPersonId, setContactPersonId] = useState(row.contactPersonId);
  const [contactQuery, setContactQuery] = useState(row.contactPreferredName || row.contactName || "");
  const [contactResults, setContactResults] = useState<{ id: string; name: string; preferredName: string | null; mobile: string | null }[]>([]);
  const [contactMobile, setContactMobile] = useState(row.contactMobile ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveHouseholdContact(row.id, contactPersonId, contactMobile || null);
      onSaved(contactPersonId, contactPersonId ? contactQuery : null, null, contactPersonId ? contactMobile || null : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
      setSaving(false);
    }
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.4)" }}
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
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "var(--heading)", marginBottom: "var(--space-4)" }}>
          Household Contact
        </h3>

        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <ModalField label="Contact">
            <input
              placeholder="Search person…"
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
            onClick={handleSave}
            disabled={saving}
            style={{ minHeight: 36, padding: "0 20px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--deep)", color: "var(--cream)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onClose}
            style={{ minHeight: 36, padding: "0 20px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
        {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 8 }}>{error}</p>}
      </div>
    </>
  );
}
