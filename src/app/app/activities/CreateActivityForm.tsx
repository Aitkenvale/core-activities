"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityWithRoster } from "./actions";
import { CadenceFields } from "@/components/CadenceFields";
import { PeoplePicker, type PickedPerson } from "./PeoplePicker";
import type { CadenceType, CadenceConfig } from "@/lib/cadence";

type Category = { id: string; label: string };
type Neighbourhood = { id: string; name: string };

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

const sectionHeadingStyle: React.CSSProperties = { fontSize: "0.85rem", color: "var(--text)", marginBottom: 8 };

// Only unlinked facilitators (quick-added here, or an existing pick who was
// never reconciled) get named — a properly-linked facilitator doesn't need
// flagging. AKA if they have one, otherwise the first word of their name.
function firstNameOrAka(name: string, preferredName: string | null): string {
  return preferredName ?? name.split(/\s+/)[0];
}

function computeUnlinkedNote(facilitators: PickedPerson[]): string {
  const names = facilitators
    .filter((p) => p.kind === "new" || p.linkStatus === "pending")
    .map((p) => (p.kind === "new" ? p.name.split(/\s+/)[0] : firstNameOrAka(p.name, p.preferredName)));
  return names.length > 0 ? `Unlinked facilitators: ${names.join(", ")}` : "";
}

function toPersonInput(p: PickedPerson) {
  return p.kind === "existing" ? { kind: "existing" as const, id: p.id } : { kind: "new" as const, name: p.name };
}

export function CreateActivityForm({ categories, neighbourhoods }: { categories: Category[]; neighbourhoods: Neighbourhood[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [neighbourhoodId, setNeighbourhoodId] = useState(neighbourhoods[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [cadenceType, setCadenceType] = useState<CadenceType>("ad_hoc");
  const [cadenceConfig, setCadenceConfig] = useState<CadenceConfig>({});
  const [facilitators, setFacilitators] = useState<PickedPerson[]>([]);
  const [participants, setParticipants] = useState<PickedPerson[]>([]);
  const [notes, setNotes] = useState("");
  const [notesTouched, setNotesTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Keeps recomputing the note from facilitators until the creator edits
  // it themselves — after that, their wording wins.
  useEffect(() => {
    if (notesTouched) return;
    setNotes(computeUnlinkedNote(facilitators));
  }, [facilitators, notesTouched]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!categoryId || !neighbourhoodId) {
      setError("Category and neighbourhood are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createActivityWithRoster({
        name,
        categoryId,
        neighbourhoodId,
        startDate: startDate || null,
        cadenceType,
        cadenceConfig,
        notes,
        facilitators: facilitators.map(toPersonInput),
        participants: participants.map(toPersonInput),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that activity.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <p style={{ color: "var(--text)", fontSize: "0.95rem" }}>Activity created.</p>
        <button
          onClick={() => router.push("/app")}
          style={{
            minHeight: "var(--tap-min)",
            padding: "0 24px",
            borderRadius: "var(--radius-pill)",
            border: "none",
            background: "var(--deep)",
            color: "var(--cream)",
            fontSize: "0.9rem",
            cursor: "pointer",
            justifySelf: "start",
          }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)", paddingBottom: "var(--space-6)" }}>
      <section>
        <FieldLabel>Name</FieldLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </section>

      <section>
        <FieldLabel>Category</FieldLabel>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id.toUpperCase()}
            </option>
          ))}
        </select>
      </section>

      <section>
        <FieldLabel>Neighbourhood</FieldLabel>
        <select value={neighbourhoodId} onChange={(e) => setNeighbourhoodId(e.target.value)} style={inputStyle}>
          {neighbourhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </section>

      <section>
        <FieldLabel>Start Date (optional)</FieldLabel>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
      </section>

      <section>
        <h3 style={sectionHeadingStyle}>Cadence</h3>
        <CadenceFields
          initialType={cadenceType}
          initialConfig={cadenceConfig}
          onChange={(type, config) => {
            setCadenceType(type);
            setCadenceConfig(config);
          }}
        />
      </section>

      <section>
        <PeoplePicker label="Facilitators" role="facilitator" selected={facilitators} onChange={setFacilitators} />
      </section>

      <section>
        <PeoplePicker label="Participants" role="participant" selected={participants} onChange={setParticipants} />
      </section>

      <section>
        <FieldLabel>Notes</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesTouched(true);
          }}
          rows={3}
          style={{ ...inputStyle, minHeight: "auto", resize: "vertical" }}
        />
      </section>

      {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          minHeight: "var(--tap-min)",
          padding: "0 24px",
          borderRadius: "var(--radius-pill)",
          border: "none",
          background: "var(--deep)",
          color: "var(--cream)",
          fontSize: "0.95rem",
          cursor: "pointer",
        }}
      >
        {submitting ? "Creating…" : "Create Activity"}
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>
      {children}
    </span>
  );
}
