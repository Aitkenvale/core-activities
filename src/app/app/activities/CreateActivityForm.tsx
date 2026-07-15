"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityWithRoster, updateActivityWithRoster, deleteActivity, type ActivityForEdit, type ActivityStatus } from "./actions";
import { CadenceFields } from "@/components/CadenceFields";
import { StatusPills } from "@/components/StatusPills";
import { PeoplePicker, type PickedPerson } from "./PeoplePicker";
import type { CadenceType, CadenceConfig } from "@/lib/cadence";

type Category = { id: string; label: string };
type Neighbourhood = { id: string; name: string };

// fontSize must be >= 16px — anything smaller makes iOS Safari auto-zoom the
// page on focus and not reliably zoom back out on blur.
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 16,
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
  return p.kind === "existing" ? { kind: "existing" as const, id: p.id } : { kind: "new" as const, name: p.name, tempId: p.tempId };
}

// How long to wait after the last change before auto-saving.
const AUTOSAVE_DELAY_MS = 700;

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
  isAdmin = false,
}: {
  categories: Category[];
  neighbourhoods: Neighbourhood[];
  mode?: "create" | "edit";
  initial?: ActivityForEdit;
  // Embeds this form inside a modal (the admin grid's Add/Edit popups)
  // instead of the standalone page's own success screen + router navigation.
  onSaved?: (result: SavedActivitySummary) => void;
  onCancel?: () => void;
  // The admin grid's own Edit popup passes this — an admin can freely move
  // status any direction with no lock and no confirmation (editing, not a
  // one-way decision), unlike a regular user on the standalone page.
  isAdmin?: boolean;
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
  // Ending is one-way for a regular user (enforced again server-side) — once
  // an activity was already ended when this form loaded, their pills lock in
  // place. An admin using this same form can still reverse it.
  const statusLocked = !isAdmin && initial?.status === "archived";
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  // Editing an existing activity starts "touched" — the loaded notes may
  // already be custom wording, so the unlinked-facilitator auto-note below
  // shouldn't stomp on them the moment the form mounts.
  const [notesTouched, setNotesTouched] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create mode only — the id of the activity auto-save has created so far,
  // or null until the first successful save. Edit mode already has initial.id.
  const createdIdRef = useRef<string | null>(null);
  // Last status value actually persisted — lets the ending-confirmation
  // gate below tell "did this change" apart from "still whatever was saved".
  const committedStatusRef = useRef<ActivityStatus>(initial?.status ?? "active");
  // Snapshot of every field as this form opened, for Cancel to revert to.
  const originalRef = useRef({
    name: initial?.name ?? "",
    categoryId: initial?.categoryId ?? categories[0]?.id ?? "",
    neighbourhoodId: initial?.neighbourhoodId ?? neighbourhoods[0]?.id ?? "",
    cadenceType: initial?.cadenceType ?? ("ad_hoc" as CadenceType),
    cadenceConfig: initial?.cadenceConfig ?? ({} as CadenceConfig),
    notes: initial?.notes ?? "",
    status: initial?.status ?? ("active" as ActivityStatus),
    facilitators: initial?.facilitators ?? [],
    participants: initial?.participants ?? [],
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keeps recomputing the note from facilitators until the creator edits
  // it themselves — after that, their wording wins.
  useEffect(() => {
    if (notesTouched) return;
    setNotes(computeUnlinkedNote(facilitators));
  }, [facilitators, notesTouched]);

  // A "new" (quick-added, not-yet-real) facilitator/participant only exists
  // locally until a save actually creates their person record. Once it
  // does, swap the local entry over to "existing" — otherwise the next
  // auto-save would see the same "new" entry again and create a duplicate
  // person every time.
  function resolveCreatedPeople(createdPeople: { tempId: string; id: string }[]) {
    if (createdPeople.length === 0) return;
    const map = new Map(createdPeople.map((c) => [c.tempId, c.id]));
    const upgrade = (list: PickedPerson[]) =>
      list.map((p) =>
        p.kind === "new" && map.has(p.tempId)
          ? { kind: "existing" as const, id: map.get(p.tempId)!, name: p.name, preferredName: null, linkStatus: "pending" as const }
          : p,
      );
    setFacilitators(upgrade);
    setParticipants(upgrade);
  }

  // The actual auto-save — called from the debounce below, and flushed
  // immediately by the "Auto-Save"/Cancel buttons. Silently does nothing
  // if the form isn't filled in enough to save yet (e.g. right after
  // opening a blank Create Activity form) rather than erroring mid-type.
  async function persist(): Promise<boolean> {
    if (!name.trim() || !categoryId || !neighbourhoodId) return false;
    setSaving(true);
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
      } else if (createdIdRef.current) {
        const result = await updateActivityWithRoster(createdIdRef.current, {
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
        resolveCreatedPeople(result.createdPeople);
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
        createdIdRef.current = created.id;
        resolveCreatedPeople(created.createdPeople);
      }
      committedStatusRef.current = status;
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't ${mode === "edit" ? "save" : "create"} that activity.`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Auto-saves ~700ms after the last change to anything below. Ending an
  // activity is the one exception — a regular user flipping the status pill
  // to Closed shouldn't silently lock it forever in the background; that
  // specific transition skips the debounce and opens the confirm modal
  // instead (see handleConfirmEnd/handleDeclineEnd), and clears any timer
  // already pending so an unrelated field's autosave can't sneak the
  // unconfirmed status through underneath it.
  useEffect(() => {
    if (mode === "edit" && !isAdmin && status === "archived" && committedStatusRef.current !== "archived") {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setShowEndConfirm(true);
      return;
    }
    saveTimer.current = setTimeout(() => {
      persist();
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, categoryId, neighbourhoodId, cadenceType, cadenceConfig, notes, facilitators, participants, startDate, status]);

  function handleDeclineEnd() {
    setShowEndConfirm(false);
    setStatus(committedStatusRef.current);
  }

  function handleConfirmEnd() {
    setShowEndConfirm(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    persist();
  }

  // The relabeled former Save button — auto-save already did the work, this
  // just flushes anything still mid-debounce and then leaves.
  async function handleFinish() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!categoryId || !neighbourhoodId) {
      setError("Category and neighbourhood are required.");
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const ok = await persist();
    if (!ok) return;
    if (mode === "edit") {
      if (onSaved) onSaved({ id: initial!.id, name, startDate: initial!.startDate, cadenceType, hidden: status === "archived" });
      else router.push("/app/activities");
    } else if (createdIdRef.current) {
      if (onSaved) onSaved({ id: createdIdRef.current, name, startDate: startDate || null, cadenceType, hidden: false });
      else router.push("/app/activities");
    }
  }

  // Cancel undoes whatever auto-save already persisted during this editing
  // session — in edit mode that means writing the original snapshot back;
  // in create mode, since nothing existed before, it means deleting the
  // activity auto-save just created (a real delete, not the usual hidden
  // soft-delete, since the row genuinely never should have existed).
  async function handleCancel() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setCancelling(true);
    try {
      if (mode === "edit") {
        await updateActivityWithRoster(initial!.id, {
          name: originalRef.current.name,
          categoryId: originalRef.current.categoryId,
          neighbourhoodId: originalRef.current.neighbourhoodId,
          cadenceType: originalRef.current.cadenceType,
          cadenceConfig: originalRef.current.cadenceConfig,
          notes: originalRef.current.notes,
          status: originalRef.current.status,
          facilitators: originalRef.current.facilitators.map(toPersonInput),
          participants: originalRef.current.participants.map(toPersonInput),
        });
      } else if (createdIdRef.current) {
        await deleteActivity(createdIdRef.current);
      }
    } catch {
      // Best-effort revert — still leave either way rather than trapping
      // the user in the form over a failed cleanup call.
    } finally {
      setCancelling(false);
    }
    if (onCancel) onCancel();
    else router.push("/app/activities");
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
          {/* globals.css overrides the internal pseudo-element iOS Safari
              actually centers; minWidth:0 stops it rendering wider than
              every other field here (same fix as the Add Info modal's DOB). */}
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...inputStyle, textAlign: "left", minWidth: 0 }} />
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
          onClick={handleCancel}
          disabled={cancelling || saving}
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
          {cancelling ? "Undoing…" : "Cancel"}
        </button>
        <button
          onClick={handleFinish}
          disabled={cancelling || saving}
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
          {saving ? "Saving…" : "Auto-Save"}
        </button>
      </div>

      {showEndConfirm && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}
          onClick={handleDeclineEnd}
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
                onClick={handleDeclineEnd}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer", padding: "8px 12px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEnd}
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
