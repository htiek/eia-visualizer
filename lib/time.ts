const HOUR_MS = 60 * 60 * 1000;

// EIA writes hours as the UTC hour they end on: "2026-10-08T03" covers 02:00–03:00 UTC.
export function periodToDate(period: string): Date {
  return new Date(`${period}:00:00Z`);
}

export function hoursBetween(earlier: string, later: string): number {
  return (periodToDate(later).getTime() - periodToDate(earlier).getTime()) / HOUR_MS;
}

// How old the hour `period` was at the moment `at` (an ISO timestamp), in whole hours.
export function hoursOld(period: string, at: string): number {
  return Math.floor((Date.parse(at) - periodToDate(period).getTime()) / HOUR_MS);
}

// Node and browsers disagree on which Unicode spaces go in formatted dates,
// which would make server-rendered text fail to hydrate. Plain spaces only.
const plain = (text: string) => text.replace(/\s/g, " ");

const FIELDS = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const;

// "Oct 7, 7:00 – 8:00 PM PDT"
export function formatHourRange(period: string, timeZone: string): string {
  const end = periodToDate(period);
  const start = new Date(end.getTime() - HOUR_MS);
  return plain(new Intl.DateTimeFormat("en-US", { ...FIELDS, timeZone }).formatRange(start, end));
}

// "Oct 8, 2026, 3:52 PM PDT"
export function formatTimestamp(iso: string, timeZone: string): string {
  return plain(new Intl.DateTimeFormat("en-US", { ...FIELDS, year: "numeric", timeZone }).format(new Date(iso)));
}

// An axis label for the start of the hour, or null if it doesn't get one.
// Labels fall every six hours, with the date at midnight: "Oct 8", "6 AM", "12 PM", "6 PM".
export function hourTick(period: string, timeZone: string): string | null {
  const start = new Date(periodToDate(period).getTime() - HOUR_MS);
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(start));
  if (hour % 6 !== 0) return null;
  const options = hour === 0 ? ({ month: "short", day: "numeric" } as const) : ({ hour: "numeric" } as const);
  return plain(new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(start));
}
