export type CadenceType = "weekly_term" | "every_n_weeks" | "nth_weekday_of_month" | "ad_hoc";

export type CadenceConfig = {
  weekday?: string; // "Monday" etc.
  interval_weeks?: number;
  anchor_date?: string; // YYYY-MM-DD
  occurrence?: "first" | "second" | "third" | "fourth" | "last";
};

export type TermRange = { startDate: string; endDate: string };

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function toDate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function isWithinAnyTerm(date: Date, terms: TermRange[]): boolean {
  return terms.some((t) => date >= toDate(t.startDate) && date <= toDate(t.endDate));
}

// All dates matching the cadence's weekday, walking backward from `from`
// (inclusive), skipping any date outside the term ranges for weekly_term.
function* candidateDatesBackward(cadenceType: CadenceType, config: CadenceConfig, from: Date, terms: TermRange[]) {
  if (cadenceType === "ad_hoc") return;

  if (cadenceType === "weekly_term" || cadenceType === "every_n_weeks") {
    const weekdayName = config.weekday;
    const targetWeekday = weekdayName ? WEEKDAY_INDEX[weekdayName] : undefined;
    if (targetWeekday === undefined) return;

    const cursor = new Date(from);
    // step back to the most recent matching weekday
    while (cursor.getDay() !== targetWeekday) cursor.setDate(cursor.getDate() - 1);

    const intervalWeeks = cadenceType === "every_n_weeks" ? config.interval_weeks || 1 : 1;
    while (true) {
      if (cadenceType === "weekly_term" ? isWithinAnyTerm(cursor, terms) : true) {
        yield new Date(cursor);
      }
      cursor.setDate(cursor.getDate() - 7 * intervalWeeks);
    }
  }
  // nth_weekday_of_month intentionally not implemented yet — no current user of this cadence type.
}

// Suggested next date on/before `today` — a suggestion only, never a constraint.
export function getNextExpectedDate(
  cadenceType: CadenceType,
  config: CadenceConfig,
  terms: TermRange[],
  today: Date = new Date(),
): string | null {
  for (const d of candidateDatesBackward(cadenceType, config, today, terms)) {
    return toISODate(d);
  }
  return null;
}

// Last `count` expected dates on/before `today`, most recent first — used to
// let a facilitator catch up on a forgotten previous week without having to
// work out the date themselves.
export function getRecentExpectedDates(
  cadenceType: CadenceType,
  config: CadenceConfig,
  terms: TermRange[],
  count = 6,
  today: Date = new Date(),
): string[] {
  const dates: string[] = [];
  for (const d of candidateDatesBackward(cadenceType, config, today, terms)) {
    dates.push(toISODate(d));
    if (dates.length >= count) break;
  }
  return dates;
}
