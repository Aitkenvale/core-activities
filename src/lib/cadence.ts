export type CadenceType = "school_term" | "every_n_weeks" | "every_n_months" | "ad_hoc";
export type Occurrence = "first" | "second" | "third" | "fourth" | "last";

export type CadenceConfig = {
  weekdays?: string[]; // school_term, every_n_weeks
  intervalWeeks?: number; // every_n_weeks — defaults to 1 (i.e. plain "Weekly")
  intervalMonths?: number; // every_n_months — defaults to 1
  occurrences?: { occurrence: Occurrence; weekday: string }[]; // every_n_months, e.g. "1st Monday" + "3rd Monday"
};

export type TermRange = { startDate: string; endDate: string };

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function toDate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}
// NOT d.toISOString().slice(0, 10) — toISOString() converts through UTC,
// which shifts the date by a day in any timezone ahead of UTC (masked only
// because the server happens to run in UTC). Read the local fields instead,
// matching how toDate() above parses (also local time).
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// School terms conventionally end on a Friday, but a weekend-cadence class
// (e.g. Saturday) that meets the day after term technically ends is still
// part of that closing weekend — extend the effective end date to the
// Sunday of that same week rather than cutting it off mid-weekend.
function extendToEndOfWeek(d: Date): Date {
  const end = new Date(d);
  const daysUntilSunday = (7 - end.getDay()) % 7;
  end.setDate(end.getDate() + daysUntilSunday);
  return end;
}

function isWithinAnyTerm(date: Date, terms: TermRange[]): boolean {
  return terms.some((t) => date >= toDate(t.startDate) && date <= extendToEndOfWeek(toDate(t.endDate)));
}

// Whole weeks between two dates, counting from each date's own week-start
// (Sunday) — used to test N-week-interval membership against an anchor.
function weeksBetween(a: Date, b: Date): number {
  const startOfWeek = (d: Date) => {
    const s = new Date(d);
    s.setDate(s.getDate() - s.getDay());
    return s;
  };
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((startOfWeek(a).getTime() - startOfWeek(b).getTime()) / msPerWeek);
}

function monthsBetween(a: Date, b: Date): number {
  return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
}

// The date of the given weekday-occurrence within the given month (e.g.
// "2nd Tuesday of June 2026") — null if that occurrence doesn't exist (e.g.
// there's no 5th Monday this month).
function nthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: Occurrence): Date | null {
  if (occurrence === "last") {
    const d = new Date(year, month + 1, 0); // last day of month
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
    return d;
  }
  const n = { first: 1, second: 2, third: 3, fourth: 4 }[occurrence];
  const d = new Date(year, month, 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * (n - 1));
  return d.getMonth() === month ? d : null; // ran past the end of the month
}

// All dates matching the cadence, walking backward from `from` (inclusive),
// most recent first. `startDate` (the activity's own start date) doubles as
// the cycle anchor for interval>1 cadences — an activity's own start is a
// natural "cycle week/month 0" without needing a separate anchor field —
// and as a hard lower bound so a class never suggests dates before it began.
function* candidateDatesBackward(
  cadenceType: CadenceType,
  config: CadenceConfig,
  from: Date,
  terms: TermRange[],
  startDate: Date | null,
) {
  if (cadenceType === "ad_hoc") return;

  if (cadenceType === "school_term" || cadenceType === "every_n_weeks") {
    const targetWeekdays = (config.weekdays ?? []).map((w) => WEEKDAY_INDEX[w]).filter((w) => w !== undefined);
    if (targetWeekdays.length === 0) return;
    const intervalWeeks = cadenceType === "every_n_weeks" ? config.intervalWeeks || 1 : 1;

    const cursor = new Date(from);
    while (true) {
      if (startDate && cursor < startDate) return;
      if (targetWeekdays.includes(cursor.getDay())) {
        const inTerm = cadenceType === "school_term" ? isWithinAnyTerm(cursor, terms) : true;
        const inCycle = intervalWeeks <= 1 || !startDate || weeksBetween(cursor, startDate) % intervalWeeks === 0;
        if (inTerm && inCycle) yield new Date(cursor);
      }
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  if (cadenceType === "every_n_months") {
    const occurrences = config.occurrences ?? [];
    if (occurrences.length === 0) return;
    const intervalMonths = config.intervalMonths || 1;

    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const startMonth = startDate && new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (true) {
      if (startMonth && cursor < startMonth) return;
      const inCycle = intervalMonths <= 1 || !startMonth || monthsBetween(cursor, startMonth) % intervalMonths === 0;
      if (inCycle) {
        const dates = occurrences
          .map((o) => nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), WEEKDAY_INDEX[o.weekday], o.occurrence))
          .filter((d): d is Date => d !== null && d <= from)
          .sort((a, b) => b.getTime() - a.getTime());
        yield* dates;
      }
      cursor.setMonth(cursor.getMonth() - 1);
    }
  }
}

// Suggested next date on/before `today` — a suggestion only, never a constraint.
export function getNextExpectedDate(
  cadenceType: CadenceType,
  config: CadenceConfig,
  terms: TermRange[],
  startDate: string | null = null,
  today: Date = new Date(),
): string | null {
  for (const d of candidateDatesBackward(cadenceType, config, today, terms, startDate ? toDate(startDate) : null)) {
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
  startDate: string | null = null,
  today: Date = new Date(),
): string[] {
  const dates: string[] = [];
  for (const d of candidateDatesBackward(cadenceType, config, today, terms, startDate ? toDate(startDate) : null)) {
    dates.push(toISODate(d));
    if (dates.length >= count) break;
  }
  return dates;
}
