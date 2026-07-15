"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleRole, deleteRoleHistoryEntry, getRoleManagementData, type RoleRow } from "./actions";
import { getRoleLabels } from "@/lib/activityRoleLabels";
import { formatFullName } from "@/lib/formatName";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

// Who's a Teacher/Animator/etc. vs a Co-Teacher/Co-Animator/etc. right now
// — grouped by category, since PSEC and JYSEP each have their own names
// for the split. This is where an admin corrects a mistaken toggle (a
// facilitator testing the button, or misunderstanding the difference
// between the two roles) — every change is dated and kept in a per-person
// history log below, not just overwritten, since that history is exactly
// what the Attendance Records PDF relies on to report each term correctly.
export function RolesAdmin({ initialRows }: { initialRows: RoleRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busyEnrollmentId, setBusyEnrollmentId] = useState<string | null>(null);
  const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<string | null>(null);

  const byCategory = new Map<string, { categoryLabel: string; rows: RoleRow[] }>();
  for (const r of rows) {
    if (!byCategory.has(r.categoryId)) byCategory.set(r.categoryId, { categoryLabel: r.categoryLabel, rows: [] });
    byCategory.get(r.categoryId)!.rows.push(r);
  }

  async function handleToggle(row: RoleRow) {
    const nextRole = row.role === "facilitator" ? "assistant" : "facilitator";
    setBusyEnrollmentId(row.enrollmentId);
    setError(null);
    try {
      await toggleRole(row.activityInstanceId, row.personId, nextRole);
      router.refresh();
      setRows(await getRoleManagementData());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change that role.");
    } finally {
      setBusyEnrollmentId(null);
    }
  }

  async function handleDeleteHistory(historyId: string) {
    setError(null);
    try {
      await deleteRoleHistoryEntry(historyId);
      setRows(await getRoleManagementData());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that entry.");
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-3) var(--space-3) 40px" }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 4 }}>
        Teacher / Co-Teacher Roles
      </h2>
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "var(--space-4)" }}>
        Who&rsquo;s currently classified which way, and why — this informs who needs child protection training.
        Toggling here records a dated change; it doesn&rsquo;t rewrite what past reports already showed.
      </p>
      {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: "var(--space-3)" }}>{error}</p>}

      {[...byCategory.entries()].map(([categoryId, { categoryLabel, rows: categoryRows }]) => (
        <section key={categoryId} style={{ marginBottom: "var(--space-6)" }}>
          <h3 style={{ fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
            {categoryLabel}
          </h3>
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {categoryRows.map((row) => {
              const labels = getRoleLabels(row.categoryId);
              const currentLabel = row.role === "facilitator" ? labels.facilitator : labels.assistant;
              const otherLabel = row.role === "facilitator" ? labels.assistant : labels.facilitator;
              const expanded = expandedEnrollmentId === row.enrollmentId;
              return (
                <div
                  key={row.enrollmentId}
                  style={{ background: "var(--card-bg)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: "10px var(--space-4)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>{formatFullName(row.name, row.preferredName)}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: 8 }}>{row.activityName}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          padding: "3px 10px",
                          borderRadius: "var(--radius-pill)",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {currentLabel}
                      </span>
                      <button
                        onClick={() => handleToggle(row)}
                        disabled={busyEnrollmentId === row.enrollmentId}
                        style={{
                          minHeight: 32,
                          padding: "0 12px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px dashed var(--gold)",
                          background: "none",
                          color: "var(--heading)",
                          fontSize: "0.72rem",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {busyEnrollmentId === row.enrollmentId ? "…" : `→ ${otherLabel}`}
                      </button>
                      <button
                        onClick={() => setExpandedEnrollmentId(expanded ? null : row.enrollmentId)}
                        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.72rem", cursor: "pointer", textDecoration: "underline" }}
                      >
                        {expanded ? "Hide history" : `History (${row.history.length})`}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ marginTop: 8, display: "grid", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      {row.history.map((h) => {
                        const entryLabels = getRoleLabels(row.categoryId);
                        const entryLabel = h.role === "facilitator" ? entryLabels.facilitator : entryLabels.assistant;
                        return (
                          <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <span style={{ fontSize: "0.78rem", color: "var(--text)" }}>
                              {entryLabel} from {formatDate(h.effectiveFrom)}
                            </span>
                            <button
                              onClick={() => handleDeleteHistory(h.id)}
                              disabled={row.history.length <= 1}
                              title={row.history.length <= 1 ? "Can't delete the only record — toggle instead" : "Delete this entry"}
                              style={{
                                background: "none",
                                border: "none",
                                color: row.history.length <= 1 ? "var(--border)" : "var(--red)",
                                fontSize: "0.72rem",
                                cursor: row.history.length <= 1 ? "default" : "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {rows.length === 0 && <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No current Facilitators or Assistants to show.</p>}
    </div>
  );
}
