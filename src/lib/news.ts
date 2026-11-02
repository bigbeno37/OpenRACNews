// Loads everything under data/ and joins it up for the pages. Only what config/tracking.json covers is
// shown, so dropping a branch from the config also takes it off the site.
import { getCollection } from 'astro:content';
import { count, sentenceList } from './format.ts';
import type { BranchReport, BranchSnapshot, Overview, RepoSnapshot, TrackedBranch, TrackedRepo } from './schema.ts';
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

export interface Day {
  date: string;
  overview?: Overview;
  branches: BranchDay[];
  repos: RepoDay[];
  totals: { commits: number; merged: number; opened: number; contributors: number; activeBranches: number };
}

const eventCount = (facts: BranchSnapshot, event: 'opened' | 'merged' | 'closed') =>
  facts.pullRequests.filter((pr) => pr.events.includes(event)).length;

/** What a branch did, for when there's no written report, or as the line under one. */
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

export function dayFacts(day: Day): string {
  const { commits, activeBranches } = day.totals;
  return `${count(commits, 'commit')} landed across ${count(activeBranches, 'branch', 'branches')}`;
}

function totalsFor(branches: BranchDay[]): Day['totals'] {
  const people = new Set<string>();
  // A commit landing on two tracked branches on the same day, such as a release, is one commit.
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
      const facts = repoFiles.find(({ data }) => data.date === date && data.repo === repo.name)?.data;
      return facts ? [{ repo, facts }] : [];
    });
    if (branches.length === 0 && repos.length === 0) return [];
    const overview = overviews.get(date);
    return [{ date, branches, repos, totals: totalsFor(branches), ...(overview ? { overview } : {}) }];
  });
}

/** Every day on record, newest first. */
export const loadDays = () => (loaded ??= load());

/** A branch's history, newest first. */
export async function branchHistory(repo: string, branch: string): Promise<BranchDay[]> {
  return (await loadDays()).flatMap((day) => day.branches.filter((b) => b.repo.name === repo && b.branch.name === branch));
}
