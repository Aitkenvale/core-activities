"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import type { SchoolActivityOption } from "@/lib/reports/schoolAttendanceReport";

// A dedicated route (matching every other admin report/tool) styled and
// behaving like the initial dialog it's meant to be — pick which PSEC/JYSEP
// activities to include, then generate. The X in the corner backs out to
// Admin Functions rather than discarding anything, since nothing here is
// saved until Generate Report is clicked.
export function SchoolAttendancePicker({ options }: { options: SchoolActivityOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const byLabel = new Map<string, SchoolActivityOption[]>();
    for (const o of options) {
      if (!byLabel.has(o.categoryLabel)) byLabel.set(o.categoryLabel, []);
      byLabel.get(o.categoryLabel)!.push(o);
    }
    return Array.from(byLabel.entries());
  }, [options]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(groupOptions: SchoolActivityOption[], allSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const o of groupOptions) {
        if (allSelected) next.delete(o.id);
        else next.add(o.id);
      }
      return next;
    });
  }

  function handleGenerate() {
    const url = `/api/admin/school-attendance-report?activityIds=${Array.from(selected).join(",")}`;
    window.location.href = url;
  }

  return (
    <div
      style={{
        position: "relative",
        maxWidth: 560,
        margin: "var(--space-4) auto",
        background: "var(--card-bg)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-elevated)",
        padding: "var(--space-6)",
      }}
    >
      <ModalCloseButton onClick={() => router.push("/app/admin")} />
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 4, paddingRight: 28 }}>
        School Attendance
      </h2>
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "var(--space-5)" }}>
        Select which PSEC/JYSEP activities to include — generates an Excel file with one row per active participant
        (Participant Name, Household Name, Class Name), for informing schools who&rsquo;s attending.
      </p>

      {groups.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>No PSEC/JYSEP activities found.</p>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-5)" }}>
          {groups.map(([label, groupOptions]) => {
            const allSelected = groupOptions.every((o) => selected.has(o.id));
            return (
              <div key={label}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.78rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--warm)" }}>{label}</span>
                  <button
                    onClick={() => toggleGroup(groupOptions, allSelected)}
                    style={{ background: "none", border: "none", color: "var(--heading)", fontSize: "0.75rem", textDecoration: "underline", cursor: "pointer" }}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {groupOptions.map((o) => (
                    <label
                      key={o.id}
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
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                      {o.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={selected.size === 0}
        style={{
          marginTop: "var(--space-6)",
          minHeight: "var(--tap-min)",
          width: "100%",
          padding: "0 24px",
          borderRadius: "var(--radius-pill)",
          border: "none",
          background: selected.size === 0 ? "var(--border)" : "var(--deep)",
          color: selected.size === 0 ? "var(--muted)" : "var(--cream)",
          fontSize: "0.95rem",
          cursor: selected.size === 0 ? "default" : "pointer",
        }}
      >
        Generate Report{selected.size > 0 ? ` (${selected.size})` : ""}
      </button>
    </div>
  );
}
