// Loads everything under data/ and joins it up for the pages. The site shows one day at a time, so
// everything here answers "as of this date" and never looks past it. Only what config/tracking.json
// covers is shown, so dropping a branch from the config also takes it off the site.
import { getCollection } from 'astro:content';
import { shiftDay } from './days.ts';
import { count, percent, sentenceList } from './format.ts';
import { commitUrl, issueUrl, pullUrl, releaseUrl } from './links.ts';
import type { BranchReport, BranchSnapshot, Issue, Overview, Progress, RepoSnapshot, TrackedBranch, TrackedRepo } from './schema.ts';
import { tracking, trackedBranches } from './tracking.ts';

export interface BranchDay {
  repo: TrackedRepo;
  branch: TrackedBranch;
  date: string;
  facts: BranchSnapshot;
  report?: BranchReport;
}

export interface RepoDay {
  repo: TrackedRepo;
  facts: RepoSnapshot;
}

export interface Totals {
  commits: number;
  merged: number;
  opened: number;
  contributors: number;
  activeBranches: number;
}

export interface Day {
  date: string;
  overview?: Overview;
  branches: BranchDay[];
  repos: RepoDay[];
  totals: Totals;
}

/** How many days a project's activity bar looks back. */
export const RECENT_DAYS = 30;

/** One project as it stood on one day. */
export interface ProjectDay {
  repo: TrackedRepo;
  date: string;
  /** Each tracked branch: what it did that day if anything, and when it last did something by then. */
  branches: { branch: TrackedBranch; today?: BranchDay; lastActive?: string }[];
  /** Issues and releases from that day. */
  events?: RepoDay;
  today: Totals;
  lastActive?: string;
  /** The days up to and including this one, oldest first, quiet ones too. */
  activity: { date: string; commits: number }[];
  /** The newest matching figures by then, and how far they moved that day. */
  progress?: { current: Progress; asOf: string; change?: number };
  /** The newest full release by then. */
  latestRelease?: { tag: string; date: string };
}

const eventCount = (facts: BranchSnapshot, event: 'opened' | 'merged' | 'closed') =>
  facts.pullRequests.filter((pr) => pr.events.includes(event)).length;

/** What a branch did, in words, for when there's no written report. */
export function branchFacts(facts: BranchSnapshot): string {
  // Only the first of these says "pull request", so the list doesn't repeat it: "5 pull requests merged and 2 opened".
  const pullRequests = (
    [
      ['merged', 'merged'],
      ['opened', 'opened'],
      ['closed', 'closed without merging'],
    ] as const
  )
    .filter(([event]) => eventCount(facts, event) > 0)
    .map(([event, words], i) => {
      const n = eventCount(facts, event);
      return i === 0 ? `${count(n, 'pull request')} ${words}` : `${n} ${words}`;
    });
  return sentenceList([...(facts.totals.commits ? [count(facts.totals.commits, 'commit')] : []), ...pullRequests]);
}

/** The same across a whole project or day. */
export function totalsFacts({ commits, merged, opened }: Totals): string {
  const pullRequests = [
    ...(merged ? [`${count(merged, 'pull request')} merged`] : []),
    ...(opened ? [merged ? `${opened} opened` : `${count(opened, 'pull request')} opened`] : []),
  ];
  return sentenceList([...(commits ? [count(commits, 'commit')] : []), ...pullRequests]);
}

/** A few of the day's own titles, to stand in for a missing report: what merged, else what opened, else what landed. */
export function highlightsFrom(repo: string, facts: BranchSnapshot, limit = 4): { title: string; href: string }[] {
  const withEvent = (event: 'merged' | 'opened') => facts.pullRequests.filter((pr) => pr.events.includes(event));
  const pullRequests = withEvent('merged').length > 0 ? withEvent('merged') : withEvent('opened');
  if (pullRequests.length > 0) return pullRequests.slice(-limit).reverse().map((pr) => ({ title: pr.title, href: pullUrl(repo, pr.number) }));
  return facts.commits
    .filter((commit) => commit.landed && !commit.merge)
    .slice(-limit)
    .reverse()
    .map((commit) => ({ title: commit.headline, href: commitUrl(repo, commit.sha) }));
}

export function dayFacts(day: Day): string {
  const { commits, activeBranches } = day.totals;
  if (activeBranches === 0) return 'nothing landed on a tracked branch';
  return `${count(commits, 'commit')} landed across ${count(activeBranches, 'branch', 'branches')}`;
}

const closedWords: Record<string, string> = { COMPLETED: 'closed as completed', NOT_PLANNED: 'closed as not planned', DUPLICATE: 'closed as a duplicate' };
const issueWords = ({ events, closedAs }: Issue) =>
  sentenceList(events.map((event) => (event === 'closed' ? (closedAs && closedWords[closedAs]) || 'closed' : event)));

/** A repo's issues and releases for one day, as rows for a list. */
export function eventRows({ repo, facts }: RepoDay) {
  return [
    ...facts.releases.map((release) => ({
      repo: repo.name,
      date: facts.date,
      title: release.name || release.tag,
      href: releaseUrl(repo.name, release.tag),
      badge: release.prerelease ? 'prerelease' : 'release',
      note: release.tag,
    })),
    ...facts.issues.map((issue) => ({
      repo: repo.name,
      date: facts.date,
      title: issue.title,
      href: issueUrl(repo.name, issue.number),
      badge: 'issue',
      note: `#${issue.number} ${issueWords(issue)}`,
    })),
  ];
}

function totalsFor(branches: BranchDay[]): Totals {
  const people = new Set<string>();
  // A commit landing on two tracked branches, such as a release, is one commit.
  const commits = new Set<string>();
  for (const { repo, facts } of branches) {
    for (const author of facts.totals.authors) people.add(author);
    for (const pr of facts.pullRequests) people.add(pr.author);
    for (const commit of facts.commits) if (!commit.merge) commits.add(`${repo.name}/${commit.sha}`);
  }
  return {
    commits: commits.size,
    merged: branches.reduce((sum, b) => sum + eventCount(b.facts, 'merged'), 0),
    opened: branches.reduce((sum, b) => sum + eventCount(b.facts, 'opened'), 0),
    contributors: people.size,
    activeBranches: branches.length,
  };
}

let loaded: Promise<Day[]> | undefined;

async function load(): Promise<Day[]> {
  const [branchFiles, repoFiles, reportFiles, overviewFiles] = await Promise.all([
    getCollection('branchSnapshots'),
    getCollection('repoSnapshots'),
    getCollection('branchReports'),
    getCollection('overviews'),
  ]);
  const key = (date: string, repo: string, branch: string) => `${date}/${repo}/${branch}`;
  const factsByKey = new Map(branchFiles.map(({ data }) => [key(data.date, data.repo, data.branch), data]));
  const reportsByKey = new Map(reportFiles.map(({ data }) => [key(data.date, data.repo, data.branch), data]));
  const repoFactsByKey = new Map(repoFiles.map(({ data }) => [`${data.date}/${data.repo}`, data]));
  const overviews = new Map(overviewFiles.map(({ data }) => [data.date, data]));

  const dates = [...new Set([...branchFiles, ...repoFiles].map(({ data }) => data.date))].sort().reverse();
  return dates.flatMap((date): Day[] => {
    const branches = trackedBranches().flatMap(({ repo, branch }): BranchDay[] => {
      const facts = factsByKey.get(key(date, repo.name, branch.name));
      if (!facts) return [];
      const report = reportsByKey.get(key(date, repo.name, branch.name));
      return [{ repo, branch, date, facts, ...(report ? { report } : {}) }];
    });
    const repos = tracking.repos.flatMap((repo): RepoDay[] => {
      const facts = repoFactsByKey.get(`${date}/${repo.name}`);
      return facts ? [{ repo, facts }] : [];
    });
    if (branches.length === 0 && repos.length === 0) return [];
    const overview = overviews.get(date);
    return [{ date, branches, repos, totals: totalsFor(branches), ...(overview ? { overview } : {}) }];
  });
}

/** Every day something happened, newest first. */
export const loadDays = () => (loaded ??= load());

/**
 * Every calendar day from the first on record to the latest, oldest first. Quiet days count, so going back
 * a day always moves exactly one day.
 */
export async function dayRange(): Promise<string[]> {
  const days = await loadDays();
  const [newest, oldest] = [days[0]?.date, days.at(-1)?.date];
  if (!newest || !oldest) return [];
  const range: string[] = [];
  for (let date = oldest; date <= newest; date = shiftDay(date, 1)) range.push(date);
  return range;
}

/** One day across every project. A quiet day is simply empty. */
export async function dayOn(date: string): Promise<Day> {
  return (await loadDays()).find((day) => day.date === date) ?? { date, branches: [], repos: [], totals: totalsFor([]) };
}

/** One project as it stood on one day, using nothing from after it. */
export async function projectOn(repo: TrackedRepo, date: string): Promise<ProjectDay> {
  const days = (await loadDays()).filter((day) => day.date <= date);
  const history = days.flatMap((day) => day.branches.filter((b) => b.repo.name === repo.name));
  const todays = history.filter((day) => day.date === date);

  const branches = repo.branches.map((branch) => {
    const own = history.filter((day) => day.branch.name === branch.name);
    const today = own[0]?.date === date ? own[0] : undefined;
    return { branch, ...(today ? { today } : {}), ...(own[0] ? { lastActive: own[0].date } : {}) };
  });

  // The window starts no earlier than the first day on record, so missing data never reads as a quiet spell.
  const firstOnRecord = days.at(-1)?.date ?? date;
  const activity: ProjectDay['activity'] = [];
  for (let i = RECENT_DAYS - 1; i >= 0; i--) {
    const day = shiftDay(date, -i);
    if (day >= firstOnRecord) activity.push({ date: day, commits: totalsFor(history.filter((b) => b.date === day)).commits });
  }

  const withProgress = history.filter((day) => day.facts.progress);
  const [newest, previous] = withProgress;
  const progress = newest?.facts.progress
    ? {
        current: newest.facts.progress,
        asOf: newest.date,
        ...(newest.date === date && previous?.facts.progress ? { change: percent(newest.facts.progress.code) - percent(previous.facts.progress.code) } : {}),
      }
    : undefined;

  const releaseDay = days
    .flatMap((day) => day.repos.filter((r) => r.repo.name === repo.name))
    .map(({ facts }) => ({ date: facts.date, release: facts.releases.filter((r) => !r.prerelease).at(-1) }))
    .find(({ release }) => release);

  const events = days[0]?.date === date ? days[0].repos.find((r) => r.repo.name === repo.name) : undefined;
  return {
    repo,
    date,
    branches,
    ...(events ? { events } : {}),
    today: totalsFor(todays),
    ...(history[0] ? { lastActive: history[0].date } : {}),
    activity,
    ...(progress ? { progress } : {}),
    ...(releaseDay?.release ? { latestRelease: { tag: releaseDay.release.tag, date: releaseDay.date } } : {}),
  };
}
