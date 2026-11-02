import type { Push } from './schema.ts';

const numbers = new Intl.NumberFormat('en-GB');
export const formatNumber = (n: number) => numbers.format(n);

/** "1 commit", "2,300 commits". */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`;
}

/** Joins items in a sentence: "a", "a and b", "a, b and c". */
export function sentenceList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** How many pushes and merges landed in each UTC hour. */
export function landingsByHour(pushes: Push[]): number[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const push of pushes) hours[new Date(push.at).getUTCHours()]! += 1;
  return hours;
}

/** How strongly to draw an hour. The steps are fixed, so a bar means the same thing on every card and day. */
export function hourOpacity(landings: number): number {
  if (landings === 0) return 0;
  if (landings === 1) return 0.45;
  if (landings <= 3) return 0.65;
  if (landings <= 7) return 0.85;
  return 1;
}

const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** The same bar in words, for screen readers. */
export function describeHours(hours: number[]): string {
  const active = hours.flatMap((n, h) => (n > 0 ? [`${hour(h)} ${n}`] : []));
  return active.length === 0
    ? 'Nothing landed on this branch on this day.'
    : `Pushes and merges landed per UTC hour: ${active.join(', ')}.`;
}

export const hourLabel = (h: number, landings: number) => `${hour(h)} UTC: ${count(landings, 'push or merge', 'pushes and merges')} landed`;

/** "14:05" from a GitHub timestamp, in UTC. */
export const timeOf = (timestamp: string) => new Date(timestamp).toISOString().slice(11, 16);
