// A "day" is always a UTC calendar day, written YYYY-MM-DD, covering 00:00:00 to 23:59:59.

/** The UTC day a GitHub timestamp falls on. */
export function dayOf(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

export function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

/** The most recent day that has ended. Today is never snapshotted: it isn't over yet. */
export function lastCompleteDay(now: Date = new Date()): string {
  return shiftDay(now.toISOString().slice(0, 10), -1);
}

/** The `count` most recent finished days, oldest first. */
export function recentDays(count: number, now: Date = new Date()): string[] {
  const last = lastCompleteDay(now);
  return Array.from({ length: count }, (_, i) => shiftDay(last, i - count + 1));
}

const longFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayMonthFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export const formatDay = (day: string) => longFormat.format(new Date(`${day}T00:00:00Z`));
export const formatDayMonth = (day: string) => dayMonthFormat.format(new Date(`${day}T00:00:00Z`));
export const formatDayShort = (day: string) => shortFormat.format(new Date(`${day}T00:00:00Z`));
