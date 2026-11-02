import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginOf } from './collect.ts';
import { contributorsOn } from './contributors.ts';
import type { BranchSnapshot, Commit, PullRequest } from './schema.ts';

const commit = (author: string, committedAt: string, extra: Partial<Commit> = {}): Commit => ({
  sha: `${author}${committedAt}`,
  headline: 'x',
  author,
  committedAt,
  merge: false,
  landed: true,
  ...extra,
});
const pullRequest = (author: string, number = 1): PullRequest => ({
  number,
  title: 'x',
  author,
  draft: false,
  head: 'x',
  events: ['opened'],
  mergedBy: null,
  additions: 0,
  deletions: 0,
  changedFiles: 0,
});
const snapshot = (commits: Commit[], pullRequests: PullRequest[], branch = 'main'): BranchSnapshot => ({
  date: '2026-10-31',
  repo: 'rac1-decomp',
  branch,
  capturedAt: '2026-11-01T00:00:00Z',
  totals: { commits: 0, merges: 0, landed: 0, additions: 0, deletions: 0, pushes: 0, forcePushes: 0, authors: [] },
  warnings: [],
  pushes: [],
  pullRequests,
  commits,
});
const query = (href: string | undefined) => decodeURIComponent(new URL(href!).searchParams.get('q')!);

test('someone with a pull request links to their pull requests that day, against that branch', () => {
  const [person] = contributorsOn('rac1-decomp', snapshot([commit('ana', '2026-10-31T09:00:00Z')], [pullRequest('ana')], 'develop'));
  assert.ok(person!.href!.startsWith('https://github.com/OpenRAC/rac1-decomp/pulls?'));
  assert.equal(query(person!.href), 'is:pr author:ana base:develop (created:2026-10-31 OR closed:2026-10-31)');
  assert.equal(person!.avatar, 'https://github.com/ana.png?size=56');
});

test('someone with only commits links to the commits, reaching back to their earliest', () => {
  const [person] = contributorsOn('rac1-decomp', snapshot([commit('ana', '2026-10-31T09:00:00Z'), commit('ana', '2026-10-29T09:00:00Z')], []));
  const url = new URL(person!.href!);
  assert.equal(url.pathname, '/OpenRAC/rac1-decomp/commits/main/');
  assert.deepEqual(Object.fromEntries(url.searchParams), { author: 'ana', since: '2026-10-29', until: '2026-10-31' });
});

test('a branch with a slash keeps its path in the commits link', () => {
  const [person] = contributorsOn('rac1-decomp', snapshot([commit('ana', '2026-10-31T09:00:00Z')], [], 'release/1.0'));
  assert.equal(new URL(person!.href!).pathname, '/OpenRAC/rac1-decomp/commits/release/1.0/');
});

test('an app links by the name search expects, and has no picture to ask for', () => {
  const [app] = contributorsOn('rac1-decomp', snapshot([], [pullRequest('openrac-bot[bot]')]));
  assert.match(query(app!.href), /author:app\/openrac-bot /);
  assert.equal(app!.avatar, undefined);
  const [committer] = contributorsOn('rac1-decomp', snapshot([commit('github-actions[bot]', '2026-10-31T09:00:00Z')], []));
  assert.equal(new URL(committer!.href!).searchParams.get('author'), 'github-actions[bot]');
});

test('a commit author with no account gets neither a link nor a picture', () => {
  const people = contributorsOn(
    'rac1-decomp',
    snapshot([commit('Stephan Kast', '2026-10-31T09:00:00Z'), commit('brian', '2026-10-31T09:00:00Z', { unlinked: true })], []),
  );
  assert.deepEqual(people, [{ name: 'Stephan Kast' }, { name: 'brian' }]);
});

test('a commit with no account does not cost someone the link their pull request earns', () => {
  const [person] = contributorsOn('rac1-decomp', snapshot([commit('ana', '2026-10-31T09:00:00Z', { unlinked: true })], [pullRequest('ana')]));
  assert.ok(person!.href);
  assert.ok(person!.avatar);
});

test('the busiest come first, and each person appears once', () => {
  const people = contributorsOn('rac1-decomp', snapshot([commit('ana', '2026-10-31T09:00:00Z'), commit('ben', '2026-10-31T09:00:00Z'), commit('ben', '2026-10-31T10:00:00Z')], [pullRequest('cam'), pullRequest('ben', 2)]));
  assert.deepEqual(people.map((p) => p.name), ['ben', 'ana', 'cam']);
});

test('apps are named the same whichever GitHub API reports them', () => {
  assert.equal(loginOf({ __typename: 'Bot', login: 'openrac-bot' }), 'openrac-bot[bot]');
  assert.equal(loginOf({ __typename: 'User', login: 'ana' }), 'ana');
  assert.equal(loginOf(null), 'ghost');
});
