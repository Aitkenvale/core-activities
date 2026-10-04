"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import type { SchoolActivityOption } from "@/lib/reports/schoolAttendanceReport";

// Children's Class first, then Junior Youth Group, whatever order the groups arrive in.
const CATEGORY_ORDER = ["psec", "jysep"];

const rowStyle: React.CSSProperties = {
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
  cursor: "pointer",
};

const buttonStyle: React.CSSProperties = {
  minHeight: "var(--tap-min)",
  padding: "0 18px",
  borderRadius: "var(--radius-pill)",
  border: "1px solid var(--border)",
  fontSize: "0.85rem",
  cursor: "pointer",
};

// The report's download, behind a popup that lists every PSEC and JYSEP group to
// tick: the file then covers the participants of just those groups. What is ticked
// is kept while the popup is closed, so it is still there when it is opened again.
export function WhatsappUpdatePicker({ options }: { options: SchoolActivityOption[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const sections = useMemo(() => {
    const byCategory = new Map<string, { label: string; groups: SchoolActivityOption[] }>();
    for (const o of options) {
      if (!byCategory.has(o.categoryId)) byCategory.set(o.categoryId, { label: o.categoryLabel, groups: [] });
      byCategory.get(o.categoryId)!.groups.push(o);
    }
    return CATEGORY_ORDER.filter((id) => byCategory.has(id)).map((id) => byCategory.get(id)!);
  }, [options]);

  // In the order they are listed, which keeps the link the same however they were ticked.
  const chosen = options.filter((o) => selected.has(o.id)).map((o) => o.id);

  // A tap outside or Escape closes the popup, as with the app's other boxes; focus
  // starts in the popup and goes back to the button that opened it.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(groups: SchoolActivityOption[], allSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const g of groups) {
        if (allSelected) next.delete(g.id);
        else next.add(g.id);
      }
      return next;
    });
  }

  function download() {
    if (chosen.length === 0) return;
    window.location.href = `/api/admin/whatsapp-update-csv?activityIds=${chosen.join(",")}`;
    close();
  }

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" style={rowStyle}>
        <span>CSV (spreadsheet)</span>
        <span style={{ fontSize: "0.75rem", color: "var(--heading)" }}>Choose groups</span>
      </button>

      {open &&
        createPortal(
          <div
            onClick={close}
            style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.65)" }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "relative",
                width: "min(92vw, 480px)",
                maxHeight: "86vh",
                // The title and the buttons stay put; only the list of groups scrolls.
                display: "flex",
                flexDirection: "column",
                background: "var(--card-bg)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-elevated)",
                padding: "var(--space-6)",
                outline: "none",
              }}
            >
              <ModalCloseButton onClick={close} />
              <h3
                id={titleId}
                style={{ flexShrink: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", color: "var(--heading)", marginBottom: 4, paddingRight: 28 }}
              >
                Choose groups
              </h3>
              <p style={{ flexShrink: 0, fontSize: "0.85rem", color: "var(--muted)", marginBottom: "var(--space-4)" }}>
                Tick the groups to include. The file lists everyone who&rsquo;s been to one of each group&rsquo;s last 4 lessons.
              </p>

              {sections.length === 0 ? (
                <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>No PSEC/JYSEP groups found.</p>
              ) : (
                // The padding and matching negative margin leave the scroll bar room beside the
                // list without moving the list itself.
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", alignContent: "start", gap: "var(--space-5)", marginRight: -8, paddingRight: 8 }}>
                  {sections.map(({ label, groups }) => {
                    const allSelected = groups.every((g) => selected.has(g.id));
                    return (
                      <div key={label}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: "0.78rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--heading)" }}>{label}</span>
                          <button
                            type="button"
                            onClick={() => toggleSection(groups, allSelected)}
                            style={{ background: "none", border: "none", color: "var(--heading)", fontSize: "0.75rem", textDecoration: "underline", cursor: "pointer" }}
                          >
                            {allSelected ? "Clear all" : "Select all"}
                          </button>
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {groups.map((g) => (
                            <label
                              key={g.id}
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
                              <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} />
                              {g.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ flexShrink: 0, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: "var(--space-5)" }}>
                <button type="button" onClick={close} style={{ ...buttonStyle, background: "var(--card-bg)", color: "var(--text)" }}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={download}
                  disabled={chosen.length === 0}
                  style={{
                    ...buttonStyle,
                    background: chosen.length === 0 ? "var(--disabled-bg)" : "var(--deep)",
                    color: chosen.length === 0 ? "var(--muted)" : "var(--cream)",
                    cursor: chosen.length === 0 ? "default" : "pointer",
                  }}
                >
                  Download CSV{chosen.length > 0 ? ` (${chosen.length})` : ""}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
