// The study logs: which programmes keep one, what their rows are, and the
// rules they share (the tap cycle, what counts as a valid box). Pure
// constants and helpers only, safe to import from client components; the
// database side lives in studyProgress.ts, which must stay server-only.
//
// A track is keyed by the activity category it belongs to, and every log is
// per person: Ruhi Camps log books x units, Children's Classes log Grades,
// Junior Youth Groups log Texts, Discourse Groups log their DSA courses.
// Study Circles don't keep one.

export type StudyTrackId = "ruhi" | "psec" | "jysep" | "discourse";

// "none" (not studied) is the in-app name for the absence of a stored row.
export type StudyStatus = "none" | "partial" | "complete";
export type StoredStudyStatus = Exclude<StudyStatus, "none">;

// The colour a row's boxes fill with once started or finished.
export type StudyTone = "green" | "blue" | "mustard";

export type StudyItem = {
  // What's stored in the database for this row. Permanent: never renumber or
  // reuse one, and never derive it from the row's position in the list.
  id: number;
  label: string;
  tone: StudyTone;
};

export type StudyTrack = {
  // Same as the id of the activity category it belongs to.
  id: StudyTrackId;
  // The button on the Attendance screen, and the title of the screen it opens.
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

const RUHI_BOOKS: StudyItem[] = range(14).map((n) => ({ id: n, label: `Book ${n}`, tone: "green" }));

const GRADES: StudyItem[] = range(6).map((n) => ({ id: n, label: `Grade ${n}`, tone: "green" }));

// The Discourse Group courses. The id is what's stored — never renumber or
// reuse one; a later course gets the next unused id.
const DSA_COURSES: StudyItem[] = [
  { id: 1, label: "DSA 1", tone: "green" },
  { id: 2, label: "DSA 2", tone: "green" },
];

// The Junior Youth texts in programme order: seven in the first year, four in
// each of the next two. The year only picks the fill colour — it is never
// shown anywhere, since which text a group is on varies so much between
// groups. To add a text later, give it the next unused id and slot it in
// where it belongs; the order here can change freely because the id, not the
// position, is what's stored.
const YEAR_TONE: Record<1 | 2 | 3, StudyTone> = { 1: "green", 2: "blue", 3: "mustard" };
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
  { id: "ruhi", title: "Ruhi Units", cornerLabel: "Book", units: 3, legendTone: "green", items: RUHI_BOOKS },
  { id: "psec", title: "Grades", cornerLabel: "Grade", units: 1, legendTone: "green", items: GRADES },
  { id: "jysep", title: "Texts", cornerLabel: "Text", units: 1, longLabels: true, legendTone: "neutral", items: JY_TEXTS },
  { id: "discourse", title: "DSA Courses", cornerLabel: "Course", units: 1, legendTone: "green", items: DSA_COURSES },
];

// The study log an activity category keeps, if any.
export function studyTrackFor(categoryId: string): StudyTrack | null {
  return TRACKS.find((t) => t.id === categoryId) ?? null;
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

export function studyCellKey(personId: string, item: number, unit: number): string {
  return `${personId}:${item}:${unit}`;
}

export function assertValidStudyCell(track: StudyTrack, item: number, unit: number) {
  if (!Number.isInteger(item) || !track.items.some((i) => i.id === item)) throw new Error(`Invalid ${track.cornerLabel.toLowerCase()}.`);
  if (!Number.isInteger(unit) || unit < 1 || unit > track.units) throw new Error("Invalid unit.");
}
