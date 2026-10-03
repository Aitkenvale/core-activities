// The study logs: which programmes keep one, what their rows are, and the
// rules they share (the tap cycle, what counts as a valid box). Pure
// constants and helpers only, safe to import from client components; the
// database side lives in studyProgress.ts, which must stay server-only.
//
// A track is one study log, and every log is per person: the Ruhi books x
// units (kept by Ruhi Camps and Study Circles alike — they work through the
// same books, so it's one record per person whichever kind of activity it's
// updated from), the Ruhi Branches (the same two kinds of activity, one box
// each rather than units), Children's Grades, Junior Youth Texts, and the
// Discourse Group's DSA courses. The Attendance study screen can edit any of
// them for an activity's participants (STUDY_SECTIONS, below); which one it
// opens on is the activity's own category (defaultStudySection).

export type StudyTrackId = "ruhi" | "ruhi_branches" | "psec" | "jysep" | "discourse";

// "none" (not studied) is the in-app name for the absence of a stored row.
export type StudyStatus = "none" | "partial" | "complete";
export type StoredStudyStatus = Exclude<StudyStatus, "none">;

// The colour a row's boxes fill with once started or finished.
export type StudyTone = "green" | "blue" | "indigo" | "mustard";

export type StudyItem = {
  // What's stored in the database for this row. Permanent: never renumber or
  // reuse one, and never derive it from the row's position in the list.
  id: number;
  label: string;
  tone: StudyTone;
};

export type StudyTrack = {
  // What's stored with each log row.
  id: StudyTrackId;
  // What this log is called where you pick which one to edit: the programme,
  // then the part of it ("Ruhi — Branches").
  title: string;
  // Heads the column of row labels.
  cornerLabel: string;
  // Boxes per person per row: Ruhi's books have three units, the rest have none.
  units: number;
  // Row labels long enough to need a wider column that wraps.
  longLabels?: boolean;
  // What the legend's example boxes are filled with — neutral when the rows
  // don't all share one colour.
  legendTone: StudyTone | "neutral";
  items: readonly StudyItem[];
};

const range = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

// Books 1 to 7 fill green, Books 8 to 12 blue and Books 13 and 14 indigo, so the
// stages of the sequence read apart at a glance.
const RUHI_BOOKS: StudyItem[] = range(14).map((n) => ({ id: n, label: `Book ${n}`, tone: n >= 13 ? "indigo" : n >= 8 ? "blue" : "green" }));

// The courses that branch off Ruhi Books 3, 5 and 7 — recorded as one box each,
// not as units. Book 3's fill green, Book 5's blue and Book 7's indigo, the
// colours of the main sequence's own stages. The id is what's stored — never
// renumber or reuse one; a later branch gets the next unused id.
const RUHI_BRANCHES: StudyItem[] = [
  { id: 1, label: "Book 3 Branch 1 (Grade 2 part A)", tone: "green" },
  { id: 2, label: "Book 3 Branch 2 (Grade 2 part B)", tone: "green" },
  { id: 3, label: "Book 3 Grade 3", tone: "green" },
  { id: 4, label: "Book 3 Grade 4", tone: "green" },
  { id: 5, label: "Book 3 Grade 5", tone: "green" },
  { id: 6, label: "Book 3 Grade 6", tone: "green" },
  { id: 7, label: "Book 5 Branch 1", tone: "blue" },
  { id: 8, label: "Book 5 Branch 2", tone: "blue" },
  { id: 9, label: "Book 7 Branch 1", tone: "indigo" },
  { id: 10, label: "Book 7 Branch 2", tone: "indigo" },
];

const GRADES: StudyItem[] = range(6).map((n) => ({ id: n, label: `Grade ${n}`, tone: "green" }));

// The Discourse Group courses, filled yellow (the "mustard" tone). The id is
// what's stored — never renumber or reuse one; a later course gets the next
// unused id.
const DSA_COURSES: StudyItem[] = [
  { id: 1, label: "DSA 1", tone: "mustard" },
  { id: 2, label: "DSA 2", tone: "mustard" },
];

// The Junior Youth texts in programme order: seven in the first year, four in
// each of the next two. The year only picks the fill colour — it is never
// shown anywhere, since which text a group is on varies so much between
// groups. To add a text later, give it the next unused id and slot it in
// where it belongs; the order here can change freely because the id, not the
// position, is what's stored.
const YEAR_TONE: Record<1 | 2 | 3, StudyTone> = { 1: "green", 2: "blue", 3: "indigo" };
const jyText = (year: 1 | 2 | 3, id: number, label: string): StudyItem => ({ id, label, tone: YEAR_TONE[year] });

const JY_TEXTS: StudyItem[] = [
  jyText(1, 1, "Breezes of Confirmation"),
  jyText(1, 2, "Wellsprings of Joy"),
  jyText(1, 3, "Habits of an Orderly Mind"),
  jyText(1, 4, "Glimmerings of Hope"),
  jyText(1, 5, "Walking the Straight Path"),
  jyText(1, 6, "On Health and Well-Being"),
  jyText(1, 7, "Spirit of Faith"),
  jyText(2, 8, "Thinking About Numbers"),
  jyText(2, 9, "Human Temple"),
  jyText(2, 10, "Observations & Insights"),
  jyText(2, 11, "Learning About Excellence"),
  jyText(3, 12, "Drawing on the Power of the Word"),
  jyText(3, 13, "Power of the Holy Spirit"),
  jyText(3, 14, "Rays of Light"),
  jyText(3, 15, "Making Sense of Data"),
];

const TRACKS: StudyTrack[] = [
  { id: "ruhi", title: "Ruhi — Main Sequence", cornerLabel: "Book", units: 3, legendTone: "neutral", items: RUHI_BOOKS },
  { id: "ruhi_branches", title: "Ruhi — Branches", cornerLabel: "Branch", units: 1, longLabels: true, legendTone: "neutral", items: RUHI_BRANCHES },
  { id: "psec", title: "Children's Class — Grades", cornerLabel: "Grade", units: 1, legendTone: "green", items: GRADES },
  { id: "jysep", title: "Junior Youth Group — Texts", cornerLabel: "Text", units: 1, longLabels: true, legendTone: "neutral", items: JY_TEXTS },
  { id: "discourse", title: "Discourse — Courses", cornerLabel: "Course", units: 1, legendTone: "mustard", items: DSA_COURSES },
];

// A track by its own id — what's stored with a log, and passed between the
// screens and the server. Not a category id: see defaultStudySection.
export function studyTrackFor(trackId: string): StudyTrack | null {
  return TRACKS.find((t) => t.id === trackId) ?? null;
}

// The sections of study history the Attendance study screen can edit for an
// activity's participants, in the order its title menu lists them. Any activity
// can edit any of them — a Children's Class's participants may well be on the
// Ruhi books too.
const SECTION_ORDER: StudyTrackId[] = ["psec", "jysep", "ruhi", "ruhi_branches", "discourse"];
export const STUDY_SECTIONS: readonly StudyTrack[] = SECTION_ORDER.flatMap((id) => {
  const track = studyTrackFor(id);
  return track ? [track] : [];
});

// The section the study screen opens on: the one that belongs to the activity's
// own category. Study Circles and Ruhi Camps share the Ruhi books.
const DEFAULT_SECTION = new Map<string, StudyTrackId>([
  ["psec", "psec"],
  ["jysep", "jysep"],
  ["sc", "ruhi"],
  ["ruhi", "ruhi"],
  ["discourse", "discourse"],
]);

export function defaultStudySection(categoryId: string): StudyTrackId {
  return DEFAULT_SECTION.get(categoryId) ?? "ruhi";
}

export function studyUnits(track: StudyTrack): number[] {
  return range(track.units);
}

export function isStudyStatus(value: unknown): value is StudyStatus {
  return value === "none" || value === "partial" || value === "complete";
}

// Tapping cycles — not studied, then partly, then completed, then back to
// not studied.
export function nextStudyStatus(status: StudyStatus): StudyStatus {
  if (status === "none") return "partial";
  if (status === "partial") return "complete";
  return "none";
}

const STUDY_RANK: Record<StudyStatus, number> = { none: 0, partial: 1, complete: 2 };

// Whether a change takes a box backwards (completed to partly or not studied,
// or partly to not studied). In the tap cycle that is only the last step,
// completed back to not studied. The screens ask before taking one.
export function isRegress(from: StudyStatus, to: StudyStatus): boolean {
  return STUDY_RANK[to] < STUDY_RANK[from];
}

// One box to put back exactly as it was — its state and the hidden day it
// reached it (null: none was recorded) — for the Attendance study screen's Cancel.
export type StudyRestoreBox = {
  trackId: string;
  personId: string;
  item: number;
  unit: number;
  status: StudyStatus;
  statusDate: string | null;
};

export function studyCellKey(personId: string, item: number, unit: number): string {
  return `${personId}:${item}:${unit}`;
}

export function assertValidStudyCell(track: StudyTrack, item: number, unit: number) {
  if (!Number.isInteger(item) || !track.items.some((i) => i.id === item)) throw new Error(`Invalid ${track.cornerLabel.toLowerCase()}.`);
  if (!Number.isInteger(unit) || unit < 1 || unit > track.units) throw new Error("Invalid unit.");
}
