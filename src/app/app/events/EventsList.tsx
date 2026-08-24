"use client";

import { useState } from "react";
import { createEvent, updateEvent, deleteEvent } from "./actions";
import { ModalCloseButton } from "@/components/ModalCloseButton";

type Event = { id: string; date: string; description: string };

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

export function EventsList({ initialEvents }: { initialEvents: Event[] }) {
  const [eventList, setEventList] = useState(initialEvents);
  const [modal, setModal] = useState<null | { mode: "add" } | { mode: "edit"; event: Event }>(null);

  function resort(list: Event[]): Event[] {
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }

  return (
    <>
      {/* No body heading — AppHeader's sticky title already shows "Events". */}
      <button
        onClick={() => setModal({ mode: "add" })}
        style={{
          width: "100%",
          minHeight: "var(--tap-min)",
          marginTop: "var(--space-2)",
          borderRadius: "var(--radius-md)",
          border: "1px dashed var(--gold)",
          background: "var(--cream2)",
          color: "var(--warm)",
          fontSize: "0.9rem",
          cursor: "pointer",
        }}
      >
        + Add Event
      </button>

      <div style={{ marginTop: "var(--space-3)", display: "grid", gap: 6 }}>
        {eventList.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No upcoming events.</p>
        ) : (
          eventList.map((e) => (
            <div
              key={e.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                minHeight: "var(--tap-min)",
                background: "var(--card-bg)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-card)",
                padding: "10px var(--space-4)",
              }}
            >
              <button
                onClick={() => setModal({ mode: "edit", event: e })}
                aria-label={`Edit ${e.description}`}
                style={{ flexShrink: 0, display: "flex", background: "none", border: "none", padding: 2, cursor: "pointer", color: "var(--muted)" }}
              >
                <EditIcon />
              </button>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)", letterSpacing: "0.02em" }}>{formatDate(e.date)}</p>
                <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text)" }}>{e.description}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <EventFormModal
          initial={modal.mode === "edit" ? modal.event : undefined}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setEventList((list) => resort([...list.filter((e) => e.id !== saved.id), saved]));
            setModal(null);
          }}
          onDeleted={(id) => {
            setEventList((list) => list.filter((e) => e.id !== id));
            setModal(null);
          }}
        />
      )}
    </>
  );
}

function EventFormModal({
  initial,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial?: Event;
  onClose: () => void;
  onSaved: (event: Event) => void;
  onDeleted: (id: string) => void;
}) {
  const [date, setDate] = useState(initial?.date ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await updateEvent(initial.id, date, description);
        onSaved({ id: initial.id, date, description: description.trim() });
      } else {
        const created = await createEvent(date, description);
        onSaved({ id: created.id, date: created.date, description: created.description });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEvent(initial.id);
      onDeleted(initial.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that event.");
      setDeleting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(90vw, 380px)",
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-5)",
        }}
      >
        <ModalCloseButton onClick={onClose} />
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.15rem", color: "var(--heading)", marginBottom: "var(--space-4)", paddingRight: 28 }}>
          {initial ? "Edit Event" : "Add Event"}
        </h3>

        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <label style={{ display: "grid", gap: 2 }}>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontSize: 16,
                minHeight: "var(--tap-min)",
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--card-bg)",
                color: "var(--text)",
                textAlign: "left",
                minWidth: 0,
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 2 }}>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Description</span>
            <input
              placeholder="Neighbourhood Reflection Meeting"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontSize: 16,
                minHeight: "var(--tap-min)",
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--card-bg)",
                color: "var(--text)",
              }}
            />
          </label>
        </div>

        {error && <p style={{ color: "var(--red)", fontSize: "0.8rem", marginTop: 10 }}>{error}</p>}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "var(--space-4)" }}>
          <button
            onClick={handleSave}
            disabled={saving || deleting || !date || !description.trim()}
            style={{ minHeight: 36, padding: "0 20px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--deep)", color: "var(--cream)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {saving ? "Saving…" : initial ? "Save" : "Add Event"}
          </button>
          <button
            onClick={onClose}
            disabled={saving || deleting}
            style={{ minHeight: 36, padding: "0 14px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            Cancel
          </button>
          {initial && (
            <button
              onClick={handleDelete}
              disabled={saving || deleting}
              style={{ marginLeft: "auto", minHeight: 36, padding: "0 14px", border: "none", background: "none", color: "var(--red)", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
