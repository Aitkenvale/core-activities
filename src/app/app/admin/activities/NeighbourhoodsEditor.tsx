"use client";

import { useState } from "react";
import { createNeighbourhood } from "./actions";

type Neighbourhood = { id: string; name: string };

const inputStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  minHeight: 36,
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
};

// Neighbourhoods are a fixed small lookup used by the Activities dropdown —
// add-only (no rename/hide) since that's the actual need: admins expanding
// coverage into new areas, not maintaining the existing list.
export function NeighbourhoodsEditor({ initialNeighbourhoods }: { initialNeighbourhoods: Neighbourhood[] }) {
  const [neighbourhoods, setNeighbourhoods] = useState(initialNeighbourhoods);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createNeighbourhood(name);
      setNeighbourhoods((ns) => [...ns, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {neighbourhoods.map((n) => (
          <span
            key={n.id}
            style={{ padding: "4px 10px", borderRadius: "var(--radius-pill)", background: "var(--card-bg)", border: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--text)" }}
          >
            {n.name}
          </span>
        ))}
        {neighbourhoods.length === 0 && <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: 0 }}>No neighbourhoods yet.</p>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="New neighbourhood…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !name.trim()}
          style={{
            minHeight: 36,
            padding: "0 14px",
            borderRadius: "var(--radius-pill)",
            border: "none",
            background: "var(--deep)",
            color: "var(--cream)",
            fontSize: "0.8rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {busy ? "Adding…" : "+ Add"}
        </button>
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 6 }}>{error}</p>}
    </div>
  );
}
