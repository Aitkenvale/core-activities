"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityWithRoster, updateActivityWithRoster, type ActivityForEdit, type ActivityStatus } from "./actions";
import { CadenceFields } from "@/components/CadenceFields";
import { StatusPills } from "@/components/StatusPills";
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

export type SavedActivitySummary = {
  id: string;
  name: string;
  startDate: string | null;
  cadenceType: CadenceType;
  hidden: boolean;
};

export function CreateActivityForm({
  categories,
  neighbourhoods,
  mode = "create",
  initial,
  onSaved,
  onCancel,
}: {
  categories: Category[];
  neighbourhoods: Neighbourhood[];
  mode?: "create" | "edit";
  initial?: ActivityForEdit;
  // Embeds this form inside a modal (the admin grid's Add/Edit popups)
  // instead of the standalone page's own success screen + router navigation.
  onSaved?: (result: SavedActivitySummary) => void;
  onCancel?: () => void;
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
  // Ending is one-way through this form (enforced again server-side) — once
  // an activity was already ended when this form loaded, the pills lock in
  // place. An admin can still reverse it, just from the Edit Activities
  // grid's own Status column, not from here.
  const statusLocked = initial?.status === "archived";
  const [showEndConfirm, setShowEndConfirm] = useState(false);
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
        if (onSaved) onSaved({ id: initial!.id, name, startDate: initial!.startDate, cadenceType, hidden: status === "archived" });
        else setDone(true);
      } else {
        const created = await createActivityWithRoster({
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
        if (onSaved) onSaved({ id: created.id, name, startDate: created.startDate, cadenceType, hidden: false });
        else setDone(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't ${mode === "edit" ? "save" : "create"} that activity.`);
    } finally {
      setSubmitting(false);
    }
  }

  // Ending an activity is one-way through this form — a plain "Save" click
  // shouldn't be the thing that quietly locks it forever, so this catches
  // the transition and makes sure it's a deliberate choice via a real modal
  // (not window.confirm — this needs to carry the "only an admin can
  // reverse this" context, not just a yes/no).
  function handleSaveClick() {
    if (mode === "edit" && status === "archived" && initial?.status !== "archived") {
      setShowEndConfirm(true);
      return;
    }
    handleSubmit();
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
      {mode === "edit" && (
        <section>
          <StatusPills value={status} onChange={setStatus} locked={statusLocked} />
          {statusLocked && (
            <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
              This activity has ended — only an admin can reopen it.
            </p>
          )}
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

      {mode === "edit" ? (
        <section>
          <h4 style={{ fontSize: "0.85rem", color: "var(--text)", marginBottom: 8 }}>Attendees</h4>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
            Facilitators and participants can be added or hidden in the activity&rsquo;s Attendance.
          </p>
        </section>
      ) : (
        <>
          <section>
            <PeoplePicker label="Facilitators" role="facilitator" selected={facilitators} onChange={setFacilitators} />
          </section>

          <section>
            <PeoplePicker label="Participants" role="participant" selected={participants} onChange={setParticipants} />
          </section>
        </>
      )}

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
          onClick={onCancel ?? (() => router.push("/app/activities"))}
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
          onClick={handleSaveClick}
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

      {showEndConfirm && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowEndConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card-bg)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-elevated)",
              padding: "var(--space-6)",
              width: "min(90vw, 400px)",
            }}
          >
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", color: "var(--heading)", marginBottom: "var(--space-3)" }}>
              End this activity?
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text)", margin: "0 0 var(--space-5)" }}>
              This marks the activity as ended and removes it from the regular lists. Once saved, only an admin can reverse it.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer", padding: "8px 12px" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  handleSubmit();
                }}
                style={{ background: "var(--deep)", color: "var(--cream)", border: "none", borderRadius: 2, padding: "8px 20px", fontSize: "0.85rem", cursor: "pointer" }}
              >
                End Activity
              </button>
            </div>
          </div>
        </div>
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
