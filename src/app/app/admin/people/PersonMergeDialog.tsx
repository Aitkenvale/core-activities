"use client";

import { useState } from "react";
import { mergePeople, type PersonMergeFieldValues } from "./actions";
import { ModalCloseButton } from "@/components/ModalCloseButton";

// Structurally compatible with PeopleGrid's own Row — not imported directly,
// so this dialog only needs the fields it actually compares.
export type MergeCandidate = {
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
  comment: string | null;
};

type FieldKey = "name" | "preferredName" | "dob" | "household" | "mobile" | "email" | "regoYear" | "regoFormUrl" | "comment";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "preferredName", label: "AKA" },
  { key: "dob", label: "DOB" },
  { key: "household", label: "Household" },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
  { key: "regoYear", label: "Rego Year" },
  { key: "regoFormUrl", label: "Rego Form" },
  { key: "comment", label: "Notes" },
];

function fieldDisplay(c: MergeCandidate, key: FieldKey): string {
  switch (key) {
    case "name":
      return c.name;
    case "preferredName":
      return c.preferredName ?? "";
    case "dob":
      return c.dob ?? "";
    case "household":
      return c.householdName ?? "";
    case "mobile":
      return c.mobile ?? "";
    case "email":
      return c.email ?? "";
    case "regoYear":
      return c.regoYear !== null ? String(c.regoYear) : "";
    case "regoFormUrl":
      return c.regoFormUrl ?? "";
    case "comment":
      return c.comment ?? "";
  }
}

type Pick = number | "edit";

// Picking which candidate's household wins doesn't make sense to also offer
// as free text (typing a household name here wouldn't create/assign one) —
// every other field is a plain scalar, so it gets the edit fallback when
// every candidate is blank for it.
function supportsEdit(key: FieldKey): boolean {
  return key !== "household";
}

// A field-by-field comparison across 2 or 3 People rows, for the admin to
// resolve one merged record from — every field is independently "keep this
// candidate's value" (click a cell) or, only when none of the candidates
// have anything for that field, typed fresh. Which record actually survives
// (absorbs the others' enrollments/attendance and gets hidden losers) is a
// separate choice from which field values win, so e.g. candidate A's
// identity can survive with candidate B's DOB.
export function PersonMergeDialog({
  candidates,
  onClose,
  onMerged,
}: {
  candidates: MergeCandidate[];
  onClose: () => void;
  onMerged: () => void;
}) {
  const [survivorIndex, setSurvivorIndex] = useState(0);
  const [picks, setPicks] = useState<Record<FieldKey, Pick>>(() => {
    const initial = {} as Record<FieldKey, Pick>;
    for (const f of FIELDS) {
      const values = candidates.map((c) => fieldDisplay(c, f.key));
      const firstNonBlank = values.findIndex((v) => v.trim() !== "");
      if (firstNonBlank >= 0) initial[f.key] = firstNonBlank;
      else initial[f.key] = supportsEdit(f.key) ? "edit" : 0;
    }
    return initial;
  });
  const [editValues, setEditValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resolveText(key: FieldKey): string {
    const pick = picks[key];
    if (pick === "edit") return (editValues[key] ?? "").trim();
    return fieldDisplay(candidates[pick], key).trim();
  }

  function resolveFieldValues(): PersonMergeFieldValues {
    const householdPick = picks.household;
    const householdId = typeof householdPick === "number" ? candidates[householdPick].householdId : null;
    const regoYearText = resolveText("regoYear");
    return {
      name: resolveText("name") || candidates[survivorIndex].name,
      preferredName: resolveText("preferredName") || null,
      dob: resolveText("dob") || null,
      householdId,
      mobile: resolveText("mobile") || null,
      email: resolveText("email") || null,
      regoYear: regoYearText ? parseInt(regoYearText, 10) : null,
      regoFormUrl: resolveText("regoFormUrl") || null,
      comment: resolveText("comment") || null,
    };
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const survivor = candidates[survivorIndex];
      const loserIds = candidates.filter((_, i) => i !== survivorIndex).map((c) => c.id);
      await mergePeople(survivor.id, loserIds, resolveFieldValues());
      onMerged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't merge these people.");
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  const survivor = candidates[survivorIndex];
  const losers = candidates.filter((_, i) => i !== survivorIndex);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(94vw, 720px)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-6)",
        }}
      >
        <ModalCloseButton onClick={onClose} />
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.3rem", color: "var(--heading)", marginBottom: 4, paddingRight: 28 }}>
          Merge People
        </h3>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "var(--space-4)" }}>
          Pick which record to keep, then click a cell in each row to choose that value — a row with nothing on file for any of
          them can be typed in directly.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 360 + candidates.length * 160 }}>
            <thead>
              <tr>
                <th style={{ ...headerCellStyle, width: 100 }} />
                {candidates.map((c, i) => (
                  <th key={c.id} style={headerCellStyle}>
                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input type="radio" name="survivor" checked={survivorIndex === i} onChange={() => setSurvivorIndex(i)} />
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Keep this record
                      </span>
                      <span style={{ fontSize: "0.9rem", color: "var(--text)", fontWeight: 500 }}>{c.name}</span>
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((f) => {
                const values = candidates.map((c) => fieldDisplay(c, f.key));
                const allBlank = values.every((v) => v.trim() === "");
                const pick = picks[f.key];
                return (
                  <tr key={f.key}>
                    <td style={{ ...labelCellStyle }}>{f.label}</td>
                    {allBlank && supportsEdit(f.key) ? (
                      <td colSpan={candidates.length} style={valueCellStyle}>
                        <input
                          placeholder={`Enter ${f.label.toLowerCase()}…`}
                          value={editValues[f.key] ?? ""}
                          onChange={(e) => setEditValues((v) => ({ ...v, [f.key]: e.target.value }))}
                          style={editInputStyle}
                        />
                      </td>
                    ) : (
                      candidates.map((c, i) => (
                        <td
                          key={c.id}
                          onClick={() => setPicks((p) => ({ ...p, [f.key]: i }))}
                          style={{
                            ...valueCellStyle,
                            cursor: "pointer",
                            ...(pick === i
                              ? { background: "var(--cream2)", boxShadow: "inset 0 0 0 2px var(--gold)" }
                              : {}),
                          }}
                        >
                          {values[i] || <span style={{ color: "var(--border)" }}>—</span>}
                        </td>
                      ))
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && <p style={{ color: "var(--red)", fontSize: "0.8rem", marginTop: 12 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-5)" }}>
          <button
            onClick={() => setShowConfirm(true)}
            style={{ minHeight: "var(--tap-min)", padding: "0 24px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--deep)", color: "var(--cream)", fontSize: "0.9rem", cursor: "pointer" }}
          >
            Merge…
          </button>
        </div>

        {showConfirm && (
          <div style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)" }} onClick={() => !saving && setShowConfirm(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "min(90vw, 380px)", background: "var(--card-bg)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-elevated)", padding: "var(--space-5)" }}
            >
              <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "var(--heading)", marginBottom: "var(--space-3)" }}>
                Confirm merge
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5, margin: "0 0 var(--space-5)" }}>
                <strong>{losers.map((l) => l.name).join(" and ")}</strong> will be merged into <strong>{survivor.name}</strong>{" "}
                using the values you picked. Their attendance history moves across, and {losers.length === 1 ? "that record" : "those records"} will
                be hidden. This can&rsquo;t be easily undone.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={saving}
                  style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer", padding: "8px 12px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  style={{ background: "var(--red)", color: "var(--cream)", border: "none", borderRadius: 2, padding: "8px 20px", fontSize: "0.85rem", cursor: "pointer" }}
                >
                  {saving ? "Merging…" : "Confirm Merge"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const headerCellStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid var(--border)",
  textAlign: "center",
};

const labelCellStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.75rem",
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const valueCellStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.85rem",
  color: "var(--text)",
  verticalAlign: "middle",
};

const editInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "0.85rem",
  minHeight: 32,
  padding: "4px 8px",
  border: "1px solid var(--gold)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
};
