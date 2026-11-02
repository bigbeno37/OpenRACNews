import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  excerpt,
  firstParentLine,
  issueEventsOn,
  keepFirstCapture,
  landingRanges,
  parseProgress,
  pullRequestEventsOn,
  sameSnapshot,
  stringifySnapshot,
  totalsFor,
} from './collect.ts';
import { dayOf, isValidDay, lastCompleteDay, recentDays } from './days.ts';
import type { Commit, Push } from './schema.ts';

const ZERO = '0'.repeat(40);
const push = (before: string, after: string, type = 'push'): Push => ({
  at: '2026-11-01T10:00:00Z',
  type,
  actor: 'someone',
  before,
  after,
});

test('a run of pushes joins into one range', () => {
  assert.deepEqual(landingRanges([push('a', 'b'), push('b', 'c'), push('c', 'd', 'pr_merge')]), [{ from: 'a', to: 'd' }]);
});

test('a force push splits the ranges and stands alone', () => {
  assert.deepEqual(landingRanges([push('a', 'b'), push('b', 'x', 'force_push'), push('x', 'y')]), [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'x' },
    { from: 'x', to: 'y' },
  ]);
});

test('a gap in the pushes starts a new range rather than comparing across it', () => {
  assert.deepEqual(landingRanges([push('a', 'b'), push('m', 'n')]), [
    { from: 'a', to: 'b' },
    { from: 'm', to: 'n' },
  ]);
});

test('creating or deleting a branch has nothing to compare against', () => {
  assert.deepEqual(landingRanges([push(ZERO, 'a', 'branch_creation'), push('a', 'b')]), [{ from: 'a', to: 'b' }]);
  assert.deepEqual(landingRanges([push('a', 'b'), push('b', ZERO, 'branch_deletion')]), [{ from: 'a', to: 'b' }]);
});

test('the first-parent line skips what merges brought in', () => {
  // m2 merged feature (f2 <- f1, with f1 also merging master in as x) on top of m1.
  const parents = new Map([
    ['m2', ['m1', 'f2']],
    ['m1', ['base']],
    ['f2', ['x']],
    ['x', ['f1', 'm1']],
    ['f1', ['base']],
  ]);
  assert.deepEqual([...firstParentLine(parents, [{ from: 'base', to: 'm2' }])], ['m2', 'm1']);
});

test('the first-parent line stops at a commit outside the comparison', () => {
  const parents = new Map([['b', ['a']]]);
  assert.deepEqual([...firstParentLine(parents, [{ from: 'elsewhere', to: 'b' }])], ['b']);
});

test('line counts come only from landed commits, so merges are not counted twice', () => {
  const commit = (over: Partial<Commit>): Commit => ({
    sha: 's',
    headline: 'h',
    author: 'a',
    committedAt: '2026-11-01T10:00:00Z',
    merge: false,
    landed: false,
    ...over,
  });
  const totals = totalsFor(
    [
      commit({ sha: 'm', merge: true, landed: true, additions: 100, deletions: 40, author: 'zoe' }),
      commit({ sha: 'x', merge: true, author: 'amy' }),
      commit({ sha: 'f', author: 'amy' }),
    ],
    [push('a', 'm', 'pr_merge'), push('m', 'n', 'force_push')],
  );
  assert.deepEqual(totals, {
    commits: 1,
    merges: 2,
    landed: 1,
    additions: 100,
    deletions: 40,
    pushes: 2,
    forcePushes: 1,
    authors: ['amy', 'zoe'],
  });
});

test('day boundaries: 00:00:00 and 23:59:59 are in, the next second is not', () => {
  assert.equal(dayOf('2026-11-01T00:00:00Z'), '2026-11-01');
  assert.equal(dayOf('2026-11-01T23:59:59Z'), '2026-11-01');
  assert.equal(dayOf('2026-11-02T00:00:00Z'), '2026-11-02');
  assert.equal(dayOf('2026-10-31T23:59:59Z'), '2026-10-31');
});

test('a timestamp with an offset still lands on its UTC day', () => {
  assert.equal(dayOf('2026-11-01T23:30:00-02:00'), '2026-11-02');
});

test('today is never a finished day', () => {
  const now = new Date('2026-11-02T00:00:01Z');
  assert.equal(lastCompleteDay(now), '2026-11-01');
  assert.deepEqual(recentDays(3, now), ['2026-10-30', '2026-10-31', '2026-11-01']);
});

test('days roll over months and reject impossible dates', () => {
  assert.deepEqual(recentDays(2, new Date('2026-03-01T05:00:00Z')), ['2026-02-27', '2026-02-28']);
  assert.equal(isValidDay('2026-02-30'), false);
  assert.equal(isValidDay('2026-2-3'), false);
  assert.equal(isValidDay('2026-02-28'), true);
});

test('pull request events are only those on the given day', () => {
  const pr = { createdAt: '2026-10-31T22:00:00Z', mergedAt: '2026-11-01T01:00:00Z', closedAt: '2026-11-01T01:00:00Z' };
  assert.deepEqual(pullRequestEventsOn(pr, '2026-10-31'), ['opened']);
  // A merge also sets closedAt: that must not count as being closed unmerged.
  assert.deepEqual(pullRequestEventsOn(pr, '2026-11-01'), ['merged']);
  assert.deepEqual(pullRequestEventsOn(pr, '2026-11-02'), []);
});

test('a pull request closed without merging is reported as closed', () => {
  const pr = { createdAt: '2026-11-01T01:00:00Z', mergedAt: null, closedAt: '2026-11-01T02:00:00Z' };
  assert.deepEqual(pullRequestEventsOn(pr, '2026-11-01'), ['opened', 'closed']);
});

test('issue events', () => {
  const issue = { createdAt: '2026-11-01T01:00:00Z', closedAt: '2026-11-03T02:00:00Z' };
  assert.deepEqual(issueEventsOn(issue, '2026-11-01'), ['opened']);
  assert.deepEqual(issueEventsOn(issue, '2026-11-03'), ['closed']);
});

test('excerpts cut at a word and drop empty text', () => {
  assert.equal(excerpt('   ', 10), undefined);
  assert.equal(excerpt(null, 10), undefined);
  assert.equal(excerpt('short', 10), 'short');
  assert.equal(excerpt('matched several more functions', 16), 'matched several…');
});

test('snapshots serialise to valid JSON with one list item per line', () => {
  const value = { date: '2026-11-01', commits: [{ sha: 'a' }, { sha: 'b' }], warnings: [], totals: { n: 1 } };
  const text = stringifySnapshot(value);
  assert.deepEqual(JSON.parse(text), value);
  assert.match(text, /\n {4}\{"sha":"a"\},\n {4}\{"sha":"b"\}\n/);
});

test('a pull request that keeps growing does not change the day it was recorded on', () => {
  const key = (pr: { number: number }) => pr.number;
  const earlier = [{ number: 191, events: ['opened'], additions: 100 }];
  assert.deepEqual(keepFirstCapture(earlier, [{ number: 191, events: ['opened'], additions: 999 }], key), earlier);
});

test('something new on that day still gets through', () => {
  const key = (pr: { number: number }) => pr.number;
  const earlier = [{ number: 5, events: ['opened'], additions: 100 }];
  const merged = { number: 5, events: ['opened', 'merged'], additions: 120 };
  const added = { number: 6, events: ['opened'], additions: 1 };
  assert.deepEqual(keepFirstCapture(earlier, [merged, added], key), [merged, added]);
  assert.deepEqual(keepFirstCapture(undefined, [added], key), [added]);
});

test('progress reads the measures of a real objdiff report, whose numbers may be strings', () => {
  const report = { measures: { total_code: '5527936', matched_code: '4684272', total_functions: 8579, matched_functions: 7760, total_data: '100', matched_data: '25', fuzzy_match_percent: 84.7 } };
  assert.deepEqual(parseProgress(report, 'abc'), {
    sha: 'abc',
    code: { done: 4684272, total: 5527936 },
    functions: { done: 7760, total: 8579 },
    data: { done: 25, total: 100 },
  });
});

test('a report with no data measure just has no data figure', () => {
  const progress = parseProgress({ measures: { total_code: 10, matched_code: 1, total_functions: 5, matched_functions: 1 } }, 'abc');
  assert.equal(progress?.data, null);
  assert.equal(progress?.code.done, 1);
});

test('a bad data figure is dropped without losing the code figure', () => {
  const progress = parseProgress({ measures: { total_code: 10, matched_code: 1, total_data: 5, matched_data: 9 } }, 'abc');
  assert.equal(progress?.data, null);
  assert.deepEqual(progress?.code, { done: 1, total: 10 });
});

test('anything without a usable code figure is no progress at all', () => {
  assert.equal(parseProgress(null, 'abc'), null);
  assert.equal(parseProgress({}, 'abc'), null);
  assert.equal(parseProgress({ measures: { total_code: 0, matched_code: 0 } }, 'abc'), null);
  assert.equal(parseProgress({ measures: { total_code: 'lots', matched_code: 1 } }, 'abc'), null);
  assert.equal(parseProgress({ measures: { total_code: 5, matched_code: 9 } }, 'abc'), null);
});

test('re-capturing the same facts is not a change', () => {
  assert.equal(sameSnapshot({ capturedAt: '1', a: 1 }, { capturedAt: '2', a: 1 }), true);
  assert.equal(sameSnapshot({ capturedAt: '1', a: 1 }, { capturedAt: '1', a: 2 }), false);
});
