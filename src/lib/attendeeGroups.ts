import { getRoleLabels } from "@/lib/activityRoleLabels";
import type { Attendee, AttendeeRole } from "@/components/EnrolAttendeesModal";
import type { PickedPerson } from "@/app/app/activities/PeoplePicker";

export type AttendeeGroup = { role: AttendeeRole; label: string; people: Attendee[] };

// How a roster is read: by the name shown on the Attendance screen (the AKA when
// there is one, otherwise the full name), in that screen's sort. The locale is
// written out because this runs both on the server and in the browser while the
// page is drawn: leaving it to each one's default could, in principle, order two
// names differently and make the page redraw itself on load.
const byDisplayName = (a: Attendee, b: Attendee) => (a.preferredName || a.name).localeCompare(b.preferredName || b.name, "en-AU");

// A class's roster split by what each person is there as, in the order the
// Attendance screen and the Attendance Records PDF use: Participants, then the
// leaders (Teachers, Animators, Facilitators or Tutors, by class type), then their
// Co-Teachers / Co-Animators / Assistants. Each group is sorted alphabetically and
// a group with nobody in it is left out. A class type that doesn't split the role
// (Study Circles, Ruhi, Discourse: see activityRoleLabels.ts) has no second leader
// group, so anyone on its roster as an assistant is listed with the facilitators.
export function groupAttendees(attendees: Attendee[], categoryId: string): AttendeeGroup[] {
  const labels = getRoleLabels(categoryId);
  const groups: AttendeeGroup[] = [
    { role: "participant", label: "Participants", people: [] },
    { role: "facilitator", label: labels.facilitator, people: [] },
    { role: "assistant", label: labels.assistant, people: [] },
  ];
  for (const a of attendees) {
    const role: AttendeeRole = a.role === "assistant" && !labels.showAssistants ? "facilitator" : a.role;
    groups.find((g) => g.role === role)!.people.push(a);
  }
  for (const g of groups) g.people.sort(byDisplayName);
  return groups.filter((g) => g.people.length > 0);
}

// Puts newly enrolled people on a roster. Anyone already on it is left as they
// were, so a person is never listed twice.
export function mergeAttendees(current: Attendee[], added: Attendee[]): Attendee[] {
  const have = new Set(current.map((p) => p.personId));
  const fresh: Attendee[] = [];
  for (const p of added) {
    if (have.has(p.personId)) continue;
    have.add(p.personId);
    fresh.push(p);
  }
  return [...current, ...fresh];
}

// Enrolling somebody who is already on the roster would re-set their role to the
// one they were picked under (a Co-Teacher picked as a Teacher would become one,
// and nothing would be written to the dated role history that the Attendance
// Records PDF reads), so those people are set aside: `keep` is who may be enrolled,
// `left` is who is already there.
export function leaveOutEnrolled(picked: PickedPerson[], enrolled: ReadonlySet<string>): { keep: PickedPerson[]; left: PickedPerson[] } {
  const keep: PickedPerson[] = [];
  const left: PickedPerson[] = [];
  for (const p of picked) (p.kind === "existing" && enrolled.has(p.id) ? left : keep).push(p);
  return { keep, left };
}

// What the admin is told about the people set aside; null when there are none.
export function alreadyOnRosterNotice(left: PickedPerson[]): string | null {
  if (left.length === 0) return null;
  const one = left.length === 1;
  return `${left.map((p) => p.name).join(", ")} ${one ? "is" : "are"} already on this roster, so ${one ? "wasn't" : "weren't"} added.`;
}
