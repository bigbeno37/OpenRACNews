// Records what landed on each tracked branch, one file per branch per finished UTC day. Run with
// `pnpm snapshot`. Safe to re-run: files only change when the facts do. See AGENTS.md for the layout.
//
//   pnpm snapshot                       the last `lookbackDays` finished days
//   pnpm snapshot --days 7              the last 7 finished days
//   pnpm snapshot --date 2026-11-01     one day (repeatable)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  excerpt,
  firstParentLine,
  issueEventsOn,
  landingRanges,
  pullRequestEventsOn,
  sameSnapshot,
  stringifySnapshot,
  totalsFor,
} from '../src/lib/collect.ts';
import { dayOf, isValidDay, lastCompleteDay, recentDays } from '../src/lib/days.ts';
import type { Commit, Issue, PullRequest, Push, Release, TrackedBranch, TrackedRepo } from '../src/lib/schema.ts';
import { branchSnapshotSchema, repoSnapshotSchema } from '../src/lib/schema.ts';
import { branchKey, tracking } from '../src/lib/tracking.ts';

const API = 'https://api.github.com';
const DATA_DIR = 'data';
const BODY_LIMIT = 500;

const token =
  process.env.GH_TOKEN || process.env.GITHUB_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** GitHub answers large requests with the occasional 5xx, so those are retried. */
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'OpenRACNews-snapshot',
        ...init.headers,
      },
    });
    const limited = response.status === 429 || (response.status === 403 && response.headers.get('retry-after'));
    if (response.ok || attempt >= 4 || !(response.status >= 500 || limited)) return response;
    const wait = Number(response.headers.get('retry-after') ?? 0) * 1000 || attempt * 2000;
    console.warn(`  ${response.status} from GitHub, retrying in ${wait / 1000}s`);
    await sleep(wait);
  }
}

class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Follows the Link header. `keepGoing` can stop early once a page has gone back far enough. */
async function restPages<T>(path: string, read: (page: any) => T[], keepGoing: (items: T[]) => boolean = () => true) {
  const all: T[] = [];
  let url: string | null = `${API}/${path}`;
  while (url) {
    const response: Response = await request(url);
    if (!response.ok) throw new GitHubError(response.status, `${response.status} from ${url}: ${await response.text()}`);
    const items = read(await response.json());
    all.push(...items);
    if (!keepGoing(items)) break;
    url = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get('link') ?? '')?.[1] ?? null;
  }
  return all;
}

async function graphql(query: string, variables: Record<string, unknown>): Promise<any> {
  const response = await request(`${API}/graphql`, { method: 'POST', body: JSON.stringify({ query, variables }) });
  if (!response.ok) throw new GitHubError(response.status, `GraphQL ${response.status}: ${await response.text()}`);
  const { data, errors } = (await response.json()) as { data: any; errors?: unknown };
  if (errors) throw new Error(`GraphQL: ${JSON.stringify(errors)}`);
  return data;
}

/** Walks a connection newest-updated first until it reaches things not touched since `since`. */
async function updatedSince(field: string, nodeFields: string, repo: string, since: string): Promise<any[]> {
  const query = `query($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      ${field}(first: 50, after: $after, orderBy: { field: UPDATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes { updatedAt ${nodeFields} }
      }
    }
  }`;
  const found: any[] = [];
  let after: string | null = null;
  for (;;) {
    const data = await graphql(query, { owner: tracking.org, name: repo, after });
    const { nodes, pageInfo } = data.repository[field];
    const fresh = nodes.filter((node: any) => node.updatedAt >= since);
    found.push(...fresh);
    if (!pageInfo.hasNextPage || fresh.length < nodes.length) return found;
    after = pageInfo.endCursor;
  }
}

const fetchPullRequests = (repo: string, since: string) =>
  updatedSince(
    'pullRequests',
    `number title bodyText isDraft baseRefName headRefName createdAt mergedAt closedAt additions deletions changedFiles
     author { login } mergedBy { login }`,
    repo,
    since,
  );

const fetchIssues = (repo: string, since: string) =>
  updatedSince('issues', `number title bodyText createdAt closedAt stateReason author { login }`, repo, since);

async function fetchReleases(repo: string, since: string): Promise<any[]> {
  const query = `query($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      releases(first: 50, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes { tagName name isDraft isPrerelease createdAt publishedAt description author { login } }
      }
    }
  }`;
  const found: any[] = [];
  let after: string | null = null;
  for (;;) {
    const data = await graphql(query, { owner: tracking.org, name: repo, after });
    const { nodes, pageInfo } = data.repository.releases;
    found.push(...nodes.filter((node: any) => node.publishedAt && !node.isDraft));
    // Ordered by creation, so a page entirely older than the window ends the walk.
    if (!pageInfo.hasNextPage || nodes.every((node: any) => node.createdAt < since)) return found;
    after = pageInfo.endCursor;
  }
}

/** Every push to the branch since `since`, oldest first. */
async function fetchPushes(repo: string, branch: string, since: string): Promise<Push[]> {
  const ref = encodeURIComponent(`refs/heads/${branch}`);
  const raw = await restPages<any>(
    `repos/${tracking.org}/${repo}/activity?ref=${ref}&per_page=100`,
    (page) => page,
    (page) => page.length > 0 && page.at(-1).timestamp >= since,
  );
  return raw
    .filter((a) => a.timestamp >= since)
    .map((a) => ({
      at: a.timestamp as string,
      type: a.activity_type as string,
      actor: (a.actor?.login ?? null) as string | null,
      before: a.before as string,
      after: a.after as string,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Diff sizes per commit. GraphQL returns these in one request per batch, where REST takes one per commit. */
async function fetchDiffSizes(nodeIds: string[]): Promise<Map<string, { additions: number; deletions: number }>> {
  const sizes = new Map<string, { additions: number; deletions: number }>();
  const query = `query($ids: [ID!]!) { nodes(ids: $ids) { ... on Commit { oid additions deletions } } }`;
  for (let i = 0; i < nodeIds.length; i += 50) {
    const data = await graphql(query, { ids: nodeIds.slice(i, i + 50) });
    for (const node of data.nodes) if (node?.oid) sizes.set(node.oid, { additions: node.additions, deletions: node.deletions });
  }
  return sizes;
}

async function commitsFor(repo: string, pushes: Push[], warnings: string[]): Promise<Commit[]> {
  const ranges = landingRanges(pushes);
  const raw = new Map<string, any>();
  for (const { from, to } of ranges) {
    try {
      const pages = await restPages<any>(
        `repos/${tracking.org}/${repo}/compare/${from}...${to}?per_page=100`,
        (page) => page.commits,
      );
      for (const commit of pages) raw.set(commit.sha, commit);
    } catch (error) {
      // A force push can leave `from` unreachable, after which GitHub can't compare against it.
      if (error instanceof GitHubError && error.status === 404) {
        warnings.push(`GitHub could not compare ${from.slice(0, 9)}...${to.slice(0, 9)}, so its commits are missing.`);
      } else throw error;
    }
  }
  const parents = new Map([...raw].map(([sha, c]) => [sha, c.parents.map((p: any) => p.sha) as string[]]));
  const line = firstParentLine(parents, ranges);
  const sizes = await fetchDiffSizes([...line].map((sha) => raw.get(sha).node_id));
  return [...raw.values()].map((c): Commit => {
    const [headline = '', ...rest] = (c.commit.message as string).split('\n');
    const landed = line.has(c.sha);
    return {
      sha: c.sha,
      headline,
      author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
      committedAt: c.commit.committer?.date ?? c.commit.author?.date,
      merge: c.parents.length > 1,
      landed,
      ...(landed ? sizes.get(c.sha) : {}),
      ...(landed && excerpt(rest.join('\n'), BODY_LIMIT) ? { body: excerpt(rest.join('\n'), BODY_LIMIT) } : {}),
    };
  });
}

function pullRequestsOn(all: any[], branch: string, day: string): PullRequest[] {
  return all
    .filter((pr) => pr.baseRefName === branch)
    .flatMap((pr): PullRequest[] => {
      const events = pullRequestEventsOn(pr, day);
      if (events.length === 0) return [];
      const body = excerpt(pr.bodyText, BODY_LIMIT);
      return [
        {
          number: pr.number,
          title: pr.title,
          author: pr.author?.login ?? 'ghost',
          draft: pr.isDraft,
          head: pr.headRefName,
          events,
          mergedBy: pr.mergedBy?.login ?? null,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changedFiles,
          ...(body ? { body } : {}),
        },
      ];
    })
    .sort((a, b) => a.number - b.number);
}

function issuesOn(all: any[], day: string): Issue[] {
  return all
    .flatMap((issue): Issue[] => {
      const events = issueEventsOn(issue, day);
      if (events.length === 0) return [];
      const body = excerpt(issue.bodyText, BODY_LIMIT);
      return [
        {
          number: issue.number,
          title: issue.title,
          author: issue.author?.login ?? 'ghost',
          events,
          closedAs: events.includes('closed') ? (issue.stateReason ?? null) : null,
          ...(body ? { body } : {}),
        },
      ];
    })
    .sort((a, b) => a.number - b.number);
}

function releasesOn(all: any[], day: string): Release[] {
  return all
    .filter((release) => dayOf(release.publishedAt) === day)
    .map((release): Release => {
      const body = excerpt(release.description, BODY_LIMIT);
      return {
        tag: release.tagName,
        name: release.name || null,
        prerelease: release.isPrerelease,
        publishedAt: release.publishedAt,
        author: release.author?.login ?? null,
        ...(body ? { body } : {}),
      };
    })
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}

/** Writes only when the facts changed, so a re-run leaves no noise in git. */
function save(path: string, value: Record<string, unknown>): 'written' | 'unchanged' {
  if (existsSync(path) && sameSnapshot(JSON.parse(readFileSync(path, 'utf8')), value)) return 'unchanged';
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifySnapshot(value));
  return 'written';
}

async function snapshotBranch(repo: TrackedRepo, branch: TrackedBranch, days: string[], since: string, allPrs: any[]) {
  const pushes = await fetchPushes(repo.name, branch.name, since);
  for (const date of days) {
    const pushesToday = pushes.filter((push) => dayOf(push.at) === date);
    const pullRequests = pullRequestsOn(allPrs, branch.name, date);
    if (pushesToday.length === 0 && pullRequests.length === 0) continue;

    const warnings: string[] = [];
    const commits = await commitsFor(repo.name, pushesToday, warnings);
    const snapshot = branchSnapshotSchema.parse({
      date,
      repo: repo.name,
      branch: branch.name,
      capturedAt: new Date().toISOString(),
      totals: totalsFor(commits, pushesToday),
      warnings,
      pushes: pushesToday,
      pullRequests,
      commits,
    });
    const path = join(DATA_DIR, date, 'branches', `${branchKey(repo.name, branch.name)}.json`);
    const { commits: c, merges: m } = snapshot.totals;
    console.log(`  ${date} ${branch.name}: ${c} commits, ${m} merges, ${pullRequests.length} PRs (${save(path, snapshot)})`);
  }
}

async function snapshotRepo(repo: TrackedRepo, days: string[], since: string) {
  console.log(repo.name);
  const [pullRequests, issues, releases] = await Promise.all([
    fetchPullRequests(repo.name, since),
    fetchIssues(repo.name, since),
    fetchReleases(repo.name, since),
  ]);
  for (const branch of repo.branches) await snapshotBranch(repo, branch, days, since, pullRequests);
  for (const date of days) {
    const issuesToday = issuesOn(issues, date);
    const releasesToday = releasesOn(releases, date);
    if (issuesToday.length === 0 && releasesToday.length === 0) continue;
    const snapshot = repoSnapshotSchema.parse({
      date,
      repo: repo.name,
      capturedAt: new Date().toISOString(),
      issues: issuesToday,
      releases: releasesToday,
    });
    const path = join(DATA_DIR, date, 'repos', `${repo.name}.json`);
    console.log(`  ${date} repo: ${issuesToday.length} issues, ${releasesToday.length} releases (${save(path, snapshot)})`);
  }
}

function chooseDays(): string[] {
  const { values } = parseArgs({
    options: { date: { type: 'string', multiple: true }, days: { type: 'string' } },
  });
  if (!values.date?.length) {
    const count = values.days === undefined ? tracking.lookbackDays : Number(values.days);
    if (!Number.isInteger(count) || count < 1) throw new Error(`--days ${values.days} is not a positive whole number`);
    return recentDays(count);
  }
  const last = lastCompleteDay();
  for (const date of values.date) {
    if (!isValidDay(date)) throw new Error(`--date ${date} is not a YYYY-MM-DD date`);
    if (date > last) throw new Error(`--date ${date} hasn't finished yet (latest finished UTC day: ${last})`);
  }
  return [...values.date].sort();
}

const days = chooseDays();
const since = `${days[0]}T00:00:00Z`;
console.log(`Snapshotting ${days.join(', ')}`);
for (const repo of tracking.repos) await snapshotRepo(repo, days, since);
