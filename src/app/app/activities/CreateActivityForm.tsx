"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityWithRoster, updateActivityWithRoster, type ActivityForEdit, type ActivityStatus } from "./actions";
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

export function CreateActivityForm({
  categories,
  neighbourhoods,
  mode = "create",
  initial,
}: {
  categories: Category[];
  neighbourhoods: Neighbourhood[];
  mode?: "create" | "edit";
  initial?: ActivityForEdit;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [neighbourhoodId, setNeighbourhoodId] = useState(initial?.neighbourhoodId ?? neighbourhoods[0]?.id ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [cadenceType, setCadenceType] = useState<CadenceType>(initial?.cadenceType ?? "ad_hoc");
  const [cadenceConfig, setCadenceConfig] = useState<CadenceConfig>(initial?.cadenceConfig ?? {});
  const [facilitators, setFacilitators] = useState<PickedPerson[]>(initial?.facilitators ?? []);
  const [participants, setParticipants] = useState<PickedPerson[]>(initial?.participants ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<ActivityStatus>(initial?.status ?? "active");
  // Finished is one-way (enforced again server-side) — once an activity was
  // already Finished when this form loaded, the pills lock in place.
  const statusLocked = initial?.status === "archived";
  // Editing an existing activity starts "touched" — the loaded notes may
  // already be custom wording, so the unlinked-facilitator auto-note below
  // shouldn't stomp on them the moment the form mounts.
  const [notesTouched, setNotesTouched] = useState(mode === "edit");
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
      if (mode === "edit") {
        await updateActivityWithRoster(initial!.id, {
          name,
          categoryId,
          neighbourhoodId,
          cadenceType,
          cadenceConfig,
          notes,
          status,
          facilitators: facilitators.map(toPersonInput),
          participants: participants.map(toPersonInput),
        });
      } else {
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
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't ${mode === "edit" ? "save" : "create"} that activity.`);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <p style={{ color: "var(--text)", fontSize: "0.95rem" }}>{mode === "edit" ? "Activity updated." : "Activity created."}</p>
        <button
          onClick={() => router.push("/app/activities")}
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
          Back to Activities
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)", paddingBottom: "var(--space-6)" }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.35rem", color: "var(--heading)" }}>
        {mode === "edit" ? "Edit Activity" : "Create Activity"}
      </h2>

      {mode === "edit" && (
        <section>
          <FieldLabel>Status</FieldLabel>
          <StatusPills value={status} onChange={setStatus} locked={statusLocked} />
        </section>
      )}

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

      {mode === "create" && (
        <section>
          <FieldLabel>Start Date (optional)</FieldLabel>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
        </section>
      )}

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

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button
          onClick={() => router.push("/app/activities")}
          disabled={submitting}
          style={{
            minHeight: "var(--tap-min)",
            padding: "0 24px",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
            color: "var(--text)",
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
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
          {mode === "edit" ? (submitting ? "Saving…" : "Save Activity") : submitting ? "Creating…" : "Create Activity"}
        </button>
      </div>
    </div>
  );
}

const STATUS_OPTIONS: { value: ActivityStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Finished" },
];

function StatusPills({ value, onChange, locked }: { value: ActivityStatus; onChange: (v: ActivityStatus) => void; locked: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {STATUS_OPTIONS.map((opt) => {
        const active = value === opt.value;
        const disabled = locked && !active;
        return (
          <button
            key={opt.value}
            onClick={() => !locked && onChange(opt.value)}
            disabled={disabled}
            style={{
              padding: "6px 16px",
              borderRadius: "var(--radius-pill)",
              border: `1px solid ${active ? "var(--deep)" : "var(--border)"}`,
              background: active ? "var(--deep)" : "var(--card-bg)",
              color: active ? "var(--cream)" : "var(--text)",
              fontSize: "0.85rem",
              cursor: locked ? "default" : "pointer",
              opacity: disabled ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {opt.label}
          </button>
        );
      })}
      {locked && (
        <p style={{ width: "100%", margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
          Finished activities can&rsquo;t be reopened.
        </p>
      )}
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
