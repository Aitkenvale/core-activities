"use client";

import { useState } from "react";
import { enrollExistingPerson, quickAddPerson } from "@/app/app/attendance/[categoryId]/[activityInstanceId]/session/actions";
import { PeoplePicker, type PickedPerson } from "@/app/app/activities/PeoplePicker";
import { ModalCloseButton } from "@/components/ModalCloseButton";

export type Attendee = { personId: string; name: string; preferredName: string | null };

// Shared by the admin Bulk Edit Attendance grid (for a zero-attendee
// activity) and the admin Edit Activities grid (for any activity) — a
// plain add-only popup, not the fuller Edit Activity screen: Edit
// Activity's own roster is read-only to protect attendance history, but
// adding someone new never risks that, so it doesn't need the same
// restriction.
export function EnrolAttendeesModal({
  activityId,
  activityName,
  onClose,
  onEnrolled,
}: {
  activityId: string;
  activityName: string;
  onClose: () => void;
  onEnrolled: (newAttendees: Attendee[]) => void;
}) {
  const [facilitators, setFacilitators] = useState<PickedPerson[]>([]);
  const [participants, setParticipants] = useState<PickedPerson[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enrolList(list: PickedPerson[], role: "facilitator" | "participant"): Promise<Attendee[]> {
    const created: Attendee[] = [];
    for (const p of list) {
      if (p.kind === "existing") {
        await enrollExistingPerson(activityId, p.id, role);
        created.push({ personId: p.id, name: p.name, preferredName: p.preferredName });
      } else {
        const row = await quickAddPerson(activityId, p.name, role);
        created.push({ personId: row.id, name: row.name, preferredName: row.preferredName });
      }
    }
    return created;
  }

  async function handleSubmit() {
    if (facilitators.length === 0 && participants.length === 0) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const a = await enrolList(facilitators, "facilitator");
      const b = await enrolList(participants, "participant");
      onEnrolled([...a, ...b]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enrol attendees.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-6)",
          width: "min(90vw, 480px)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <ModalCloseButton onClick={onClose} />
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", color: "var(--heading)", marginBottom: "var(--space-4)", paddingRight: 28 }}>
          Enrol Attendees — {activityName}
        </h3>
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <PeoplePicker label="Facilitators" role="facilitator" selected={facilitators} onChange={setFacilitators} />
          <PeoplePicker label="Participants" role="participant" selected={participants} onChange={setParticipants} />
          {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer", padding: "8px 12px" }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ background: "var(--deep)", color: "var(--cream)", border: "none", borderRadius: 2, padding: "8px 20px", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {submitting ? "Enrolling…" : "Enrol"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
