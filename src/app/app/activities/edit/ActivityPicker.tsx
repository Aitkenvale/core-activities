"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusPills";
import type { ActivityStatus } from "../actions";

type Activity = { id: string; name: string; categoryId: string; status: ActivityStatus };

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "0.9rem",
  minHeight: "var(--tap-min)",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minHeight: "var(--tap-min)",
  width: "100%",
  textAlign: "left",
  background: "var(--card-bg)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "10px 14px",
  fontSize: "0.9rem",
  color: "var(--text)",
  cursor: "pointer",
};

// A plain search + list, same shape as the People/Facilitator picker — this
// list is at most a few dozen activities, so no server round-trip per
// keystroke is needed, just filter what's already on the page.
export function ActivityPicker({ activities, categoryLabels }: { activities: Activity[]; categoryLabels: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((a) => a.name.toLowerCase().includes(q) || (categoryLabels[a.categoryId] ?? "").toLowerCase().includes(q));
  }, [activities, query, categoryLabels]);

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <input placeholder="Search activities…" value={query} onChange={(e) => setQuery(e.target.value)} style={inputStyle} />
      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        {visible.map((a) => (
          <button key={a.id} onClick={() => router.push(`/app/activities/edit/${a.id}`)} style={rowStyle}>
            <span>{a.name}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {/* Only Paused gets a badge here — this list never includes
                  Archived (ending an activity hides it, and this query
                  excludes hidden ones), and Active is the default assumption
                  for everything else, so it doesn't need calling out. */}
              {a.status === "paused" && <StatusBadge value="paused" />}
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{a.categoryId.toUpperCase()}</span>
            </span>
          </button>
        ))}
        {visible.length === 0 && <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No activities found.</p>}
      </div>
    </div>
  );
}
