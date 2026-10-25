"use client";

import { useMemo, useState } from "react";
import type { SchoolActivityOption } from "@/lib/reports/schoolAttendanceReport";

// Children's Class first, then Junior Youth Group, whatever order the classes arrive in.
const CATEGORY_ORDER = ["psec", "jysep"];

const downloadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  minHeight: "var(--tap-min)",
  background: "var(--card-bg)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "10px var(--space-4)",
  border: "none",
  textAlign: "left",
  font: "inherit",
  fontSize: "0.9rem",
  color: "var(--text)",
};

// Every PSEC and JYSEP class, kind by kind, each with a tick box: the report covers
// the households of just the ticked classes. The two downloads wait for at least one.
export function FamilyReportPicker({ options }: { options: SchoolActivityOption[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sections = useMemo(() => {
    const byCategory = new Map<string, { label: string; classes: SchoolActivityOption[] }>();
    for (const o of options) {
      if (!byCategory.has(o.categoryId)) byCategory.set(o.categoryId, { label: o.categoryLabel, classes: [] });
      byCategory.get(o.categoryId)!.classes.push(o);
    }
    return CATEGORY_ORDER.filter((id) => byCategory.has(id)).map((id) => byCategory.get(id)!);
  }, [options]);

  // In the order they are listed, which keeps the link the same however they were ticked.
  const chosen = options.filter((o) => selected.has(o.id)).map((o) => o.id);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(classes: SchoolActivityOption[], allSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of classes) {
        if (allSelected) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  }

  function download(route: "family-report-pdf" | "family-report-csv") {
    if (chosen.length === 0) return;
    window.location.href = `/api/admin/${route}?activityIds=${chosen.join(",")}`;
  }

  const none = chosen.length === 0;
  const rowState: React.CSSProperties = { opacity: none ? 0.55 : 1, cursor: none ? "default" : "pointer" };

  return (
    <div>
      {sections.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "var(--space-5)" }}>No PSEC/JYSEP classes found.</p>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-5)", marginBottom: "var(--space-5)" }}>
          {sections.map(({ label, classes }) => {
            const allSelected = classes.every((c) => selected.has(c.id));
            return (
              <div key={label} role="group" aria-label={label}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.78rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--heading)" }}>{label}</span>
                  <button
                    type="button"
                    onClick={() => toggleSection(classes, allSelected)}
                    style={{ background: "none", border: "none", color: "var(--heading)", fontSize: "0.75rem", textDecoration: "underline", cursor: "pointer" }}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {classes.map((c) => (
                    <label
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minHeight: "var(--tap-min)",
                        padding: "6px 10px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--table-header-bg)",
                        fontSize: "0.9rem",
                        color: "var(--text)",
                        cursor: "pointer",
                      }}
                    >
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p aria-live="polite" style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0 0 var(--space-2)" }}>
        {none ? "Tick at least one class to download." : `${chosen.length} ${chosen.length === 1 ? "class" : "classes"} ticked.`}
      </p>
      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <button type="button" onClick={() => download("family-report-pdf")} disabled={none} style={{ ...downloadStyle, ...rowState }}>
          <span>PDF (A4, print-ready)</span>
          <span style={{ fontSize: "0.75rem", color: "var(--heading)" }}>Download</span>
        </button>
        <button type="button" onClick={() => download("family-report-csv")} disabled={none} style={{ ...downloadStyle, ...rowState }}>
          <span>CSV (spreadsheet)</span>
          <span style={{ fontSize: "0.75rem", color: "var(--heading)" }}>Download</span>
        </button>
      </div>
    </div>
  );
}
