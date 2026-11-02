// Loads everything under data/ and joins it up for the pages, by project and by day. Only what
// config/tracking.json covers is shown, so dropping a branch from the config also takes it off the site.
import { getCollection } from 'astro:content';
import { shiftDay } from './days.ts';
import { count, sentenceList } from './format.ts';
import { issueUrl, pullUrl, commitUrl, releaseUrl } from './links.ts';
import type { BranchReport, BranchSnapshot, Issue, Overview, RepoSnapshot, TrackedBranch, TrackedRepo } from './schema.ts';
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

interface Totals {
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

/** How many days a project's activity bar and recent numbers look back. */
export const RECENT_DAYS = 30;

export interface Project {
  repo: TrackedRepo;
  /** Each tracked branch, newest day first, in the order the config lists them. */
  branches: { branch: TrackedBranch; days: BranchDay[] }[];
  /** Issues and releases, newest day first. */
  events: RepoDay[];
  lastActive?: string;
  /** Every one of the last RECENT_DAYS days on record, oldest first, including quiet ones. */
  activity: { date: string; commits: number }[];
  recent: Totals;
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

/** Every day on record, newest first. */
export const loadDays = () => (loaded ??= load());

/** Every tracked project, in the order the config lists them. */
export async function loadProjects(): Promise<Project[]> {
  const days = await loadDays();
  const latest = days[0]?.date;
  // The window ends at the latest day on record for every project, so a quiet project shows as quiet.
  const window = latest ? Array.from({ length: RECENT_DAYS }, (_, i) => shiftDay(latest, i - RECENT_DAYS + 1)) : [];
  const inWindow = new Set(window);

  return tracking.repos.map((repo): Project => {
    const allBranchDays = days.flatMap((day) => day.branches.filter((b) => b.repo.name === repo.name));
    const lastActive = allBranchDays[0]?.date;
    const totalsByDate = new Map<string, BranchDay[]>();
    for (const day of allBranchDays) totalsByDate.set(day.date, [...(totalsByDate.get(day.date) ?? []), day]);
    return {
      repo,
      branches: repo.branches.map((branch) => ({ branch, days: allBranchDays.filter((day) => day.branch.name === branch.name) })),
      events: days.flatMap((day) => day.repos.filter((r) => r.repo.name === repo.name)),
      ...(lastActive ? { lastActive } : {}),
      activity: window.map((date) => ({ date, commits: totalsFor(totalsByDate.get(date) ?? []).commits })),
      recent: totalsFor(allBranchDays.filter((day) => inWindow.has(day.date))),
    };
  });
}
