"use client";

import { useMemo, useState } from "react";
import { enrollExistingPerson, quickAddPerson } from "@/app/app/attendance/[categoryId]/[activityInstanceId]/session/actions";
import { PeoplePicker, type PickedPerson } from "@/app/app/activities/PeoplePicker";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { alreadyOnRosterNotice, leaveOutEnrolled } from "@/lib/attendeeGroups";

// What someone is on a roster as: matches the enrollment_role column.
export type AttendeeRole = "participant" | "facilitator" | "assistant";

export type Attendee = { personId: string; name: string; preferredName: string | null; role: AttendeeRole };

// Shared by the admin Bulk Edit Attendance grid (for any activity, from its
// Add Attendee button) and the admin Edit Activities grid — a
// plain add-only popup, not the fuller Edit Activity screen: Edit
// Activity's own roster is read-only to protect attendance history, but
// adding someone new never risks that, so it doesn't need the same
// restriction.
//
// A screen that knows who is already on the roster passes their ids as
// alreadyEnrolled: enrolling them again would only re-set their role (see
// leaveOutEnrolled), so picking one of them is refused with a note instead.
export function EnrolAttendeesModal({
  activityId,
  activityName,
  alreadyEnrolled,
  onClose,
  onEnrolled,
}: {
  activityId: string;
  activityName: string;
  alreadyEnrolled?: string[];
  onClose: () => void;
  onEnrolled: (newAttendees: Attendee[]) => void;
}) {
  const [facilitators, setFacilitators] = useState<PickedPerson[]>([]);
  const [participants, setParticipants] = useState<PickedPerson[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const enrolled = useMemo(() => new Set(alreadyEnrolled ?? []), [alreadyEnrolled]);

  // The pickers report the whole list each time it changes. Anyone on the roster
  // already is dropped from it and said so, rather than being quietly re-enrolled.
  function accept(setList: (next: PickedPerson[]) => void) {
    return (next: PickedPerson[]) => {
      const { keep, left } = leaveOutEnrolled(next, enrolled);
      setNotice(alreadyOnRosterNotice(left));
      setList(keep);
    };
  }

  async function enrolList(list: PickedPerson[], role: "facilitator" | "participant"): Promise<Attendee[]> {
    const created: Attendee[] = [];
    for (const p of list) {
      if (p.kind === "existing") {
        await enrollExistingPerson(activityId, p.id, role);
        created.push({ personId: p.id, name: p.name, preferredName: p.preferredName, role });
      } else {
        const row = await quickAddPerson(activityId, p.name, role);
        created.push({ personId: row.id, name: row.name, preferredName: row.preferredName, role });
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
          <PeoplePicker label="Facilitators" role="facilitator" selected={facilitators} onChange={accept(setFacilitators)} />
          <PeoplePicker label="Participants" role="participant" selected={participants} onChange={accept(setParticipants)} />
          {notice && (
            <p role="status" style={{ color: "var(--muted)", fontSize: "0.8rem", margin: 0 }}>
              {notice}
            </p>
          )}
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
