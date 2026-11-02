// The decisions a snapshot makes, kept free of network access so they can be tested.
//
// A commit belongs to the day it landed on the branch, taken from GitHub's push activity, and not to
// the date written in the commit. A pull request merged today often carries commits dated days
// earlier: bucketing those by their own date would file them under days already reported on, and
// finished days would keep changing. Landing time also means a finished day never changes.
import type { Commit, Issue, Push, PullRequest } from './schema.ts';
import { dayOf } from './days.ts';

export interface Range {
  from: string;
  to: string;
}

const isEmptySha = (sha: string) => /^0+$/.test(sha);

/**
 * Joins a day's pushes, oldest first, into as few before...after ranges as possible, so one
 * comparison can cover a run of pushes. A force push gets a range of its own because history doesn't
 * continue through it, and creating or deleting a branch has nothing to compare against.
 */
export function landingRanges(pushes: Push[]): Range[] {
  const ranges: Range[] = [];
  let open: Range | null = null;
  const close = () => {
    if (open) ranges.push(open);
    open = null;
  };
  for (const push of pushes) {
    if (isEmptySha(push.before) || isEmptySha(push.after)) {
      close();
    } else if (push.type === 'force_push') {
      close();
      ranges.push({ from: push.before, to: push.after });
    } else if (open && (open as Range).to === push.before) {
      (open as Range).to = push.after;
    } else {
      close();
      open = { from: push.before, to: push.after };
    }
  }
  close();
  return ranges;
}

/**
 * Commits on the first-parent line of each range: what the branch itself gained. Commits that a merge
 * brought in are left out, as are "merge master into my branch" commits, whose diffs are enormous and
 * say nothing about what landed.
 */
export function firstParentLine(parents: Map<string, string[]>, ranges: Range[]): Set<string> {
  const line = new Set<string>();
  for (const { from, to } of ranges) {
    let current: string | undefined = to;
    while (current && current !== from && parents.has(current) && !line.has(current)) {
      line.add(current);
      current = parents.get(current)?.[0];
    }
  }
  return line;
}

export function totalsFor(commits: Commit[], pushes: Push[]) {
  const landed = commits.filter((c) => c.landed);
  return {
    commits: commits.filter((c) => !c.merge).length,
    merges: commits.filter((c) => c.merge).length,
    landed: landed.length,
    additions: landed.reduce((sum, c) => sum + (c.additions ?? 0), 0),
    deletions: landed.reduce((sum, c) => sum + (c.deletions ?? 0), 0),
    pushes: pushes.length,
    forcePushes: pushes.filter((p) => p.type === 'force_push').length,
    authors: [...new Set(commits.map((c) => c.author))].sort((a, b) => a.localeCompare(b)),
  };
}

export function pullRequestEventsOn(
  pr: { createdAt: string; mergedAt: string | null; closedAt: string | null },
  day: string,
): PullRequest['events'] {
  const events: PullRequest['events'] = [];
  if (dayOf(pr.createdAt) === day) events.push('opened');
  if (pr.mergedAt && dayOf(pr.mergedAt) === day) events.push('merged');
  else if (!pr.mergedAt && pr.closedAt && dayOf(pr.closedAt) === day) events.push('closed');
  return events;
}

export function issueEventsOn(issue: { createdAt: string; closedAt: string | null }, day: string): Issue['events'] {
  const events: Issue['events'] = [];
  if (dayOf(issue.createdAt) === day) events.push('opened');
  if (issue.closedAt && dayOf(issue.closedAt) === day) events.push('closed');
  return events;
}

/** Cuts free text to length at a word boundary. Returns undefined when nothing is left. */
export function excerpt(text: string | null | undefined, max: number): string | undefined {
  const clean = (text ?? '').trim();
  if (!clean) return undefined;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * JSON with each list item on one line. Commits and pull requests stay greppable, diff cleanly, and
 * take far fewer lines for an agent to read than fully indented JSON.
 */
export function stringifySnapshot(value: Record<string, unknown>): string {
  const entries = Object.entries(value);
  const lines = entries.map(([key, item], i) => {
    const comma = i < entries.length - 1 ? ',' : '';
    if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'object') {
      const rows = item.map((row, j) => `    ${JSON.stringify(row)}${j < item.length - 1 ? ',' : ''}`);
      return `  ${JSON.stringify(key)}: [\n${rows.join('\n')}\n  ]${comma}`;
    }
    return `  ${JSON.stringify(key)}: ${JSON.stringify(item)}${comma}`;
  });
  return `{\n${lines.join('\n')}\n}\n`;
}

/**
 * Keeps what a snapshot first recorded. A pull request that's still open goes on growing and can be
 * retitled long after the day it opened, so without this, revisiting a recent day would rewrite it. An
 * item only changes if something new happened to it on that day, which shows up in its events.
 */
export function keepFirstCapture<T extends { events?: readonly string[] }>(earlier: T[] | undefined, fresh: T[], key: (item: T) => string | number): T[] {
  const first = new Map((earlier ?? []).map((item) => [key(item), item]));
  return fresh.map((item) => {
    const kept = first.get(key(item));
    return kept && JSON.stringify(kept.events) === JSON.stringify(item.events) ? kept : item;
  });
}

/** Whether two snapshots say the same thing, ignoring when each was taken. */
export function sameSnapshot(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const facts = ({ capturedAt: _, ...rest }: Record<string, unknown>) => JSON.stringify(rest);
  return facts(a) === facts(b);
}
