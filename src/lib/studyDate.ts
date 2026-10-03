// "Today" for the study logs' hidden dates. The server runs in UTC, ten hours
// behind the community (Townsville, Queensland — no daylight saving), so
// toISOString() would date an early-morning edit as the day before. This reads
// the date in the community's own time zone instead. Pure, so it can be
// tested without a database.
const COMMUNITY_TIME_ZONE = "Australia/Brisbane";

// YYYY-MM-DD (the en-CA format is exactly that).
export function communityToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: COMMUNITY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
