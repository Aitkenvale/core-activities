"use client";

import { useState } from "react";
import { searchPeopleDirectory } from "./actions";
import { formatFullName } from "@/lib/formatName";

type Result = {
  id: string;
  name: string;
  preferredName: string | null;
  householdName: string | null;
  mobile: string | null;
  email: string | null;
};

export function PeopleSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleChange(value: string) {
    setQuery(value);
    setExpandedId(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(await searchPeopleDirectory(value));
  }

  return (
    <>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: "0 0 var(--space-5)" }}>
        Find Person
      </h2>
      <input
        autoFocus
        placeholder="Search by name…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontSize: 16,
          minHeight: "var(--tap-min)",
          padding: "10px 12px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--card-bg)",
          color: "var(--text)",
        }}
      />

      <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-2)" }}>
        {results.map((r) => {
          const expanded = expandedId === r.id;
          return (
            <div key={r.id} style={{ background: "var(--card-bg)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)" }}>
              <button
                onClick={() => setExpandedId(expanded ? null : r.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  minHeight: "var(--tap-min)",
                  padding: "10px var(--space-4)",
                  background: "none",
                  border: "none",
                  fontSize: "0.9rem",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                {formatFullName(r.name, r.preferredName)}
              </button>
              {expanded && (
                <div style={{ padding: "0 var(--space-4) var(--space-4)", display: "grid", gap: 6 }}>
                  <DetailRow label="Household" value={r.householdName ?? "—"} />
                  {r.mobile && <DetailRow label="Mobile" value={r.mobile} href={`tel:${r.mobile}`} />}
                  {r.email && <DetailRow label="Email" value={r.email} href={`mailto:${r.email}`} />}
                </div>
              )}
            </div>
          );
        })}
        {query.trim().length >= 2 && results.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No matches.</p>
        )}
      </div>
    </>
  );
}

function DetailRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <p style={{ fontSize: "0.85rem", color: "var(--text)", margin: 0 }}>
      <span style={{ color: "var(--muted)" }}>{label}: </span>
      {href ? (
        <a href={href} style={{ color: "var(--warm)" }}>
          {value}
        </a>
      ) : (
        value
      )}
    </p>
  );
}
