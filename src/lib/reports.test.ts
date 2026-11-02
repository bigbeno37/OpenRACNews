import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarMonths } from './calendar.ts';
import { dayOpacity, describeHours, formatChange, formatPercent, hourOpacity, landingsByHour } from './format.ts';
import { paragraphs, referencesIn, tokenize, toEscapedHtml } from './prose.ts';
import { checkBranchReport, checkOverview, knownNumbers } from './reportChecks.ts';
import type { BranchReport, BranchSnapshot, Overview, Push, RepoSnapshot } from './schema.ts';

test('prose splits into text, code spans and references', () => {
  assert.deepEqual(tokenize('Matched `func_0029` in #12, see rac2-decomp#3.'), [
    { kind: 'text', text: 'Matched ' },
    { kind: 'code', text: 'func_0029' },
    { kind: 'text', text: ' in ' },
    { kind: 'ref', text: '#12', repo: null, number: 12 },
    { kind: 'text', text: ', see ' },
    { kind: 'ref', text: 'rac2-decomp#3', repo: 'rac2-decomp', number: 3 },
    { kind: 'text', text: '.' },
  ]);
});

test('markup stays plain text: only code spans and references get any treatment', () => {
  const hostile = '<script>alert(1)</script> [link](javascript:alert(1)) <img src=x onerror=y>';
  assert.deepEqual(tokenize(hostile), [{ kind: 'text', text: hostile }]);
});

test('a number inside a code span is not a reference', () => {
  assert.deepEqual(referencesIn('see `#12` and #13'), [{ repo: null, number: 13 }]);
});

test('paragraphs split on blank lines', () => {
  assert.deepEqual(paragraphs('one\ntwo\n\n  three  \n\n'), ['one\ntwo', 'three']);
});

const branch = {
  pullRequests: [{ number: 198, title: 'perf: faster (#12 follow-up)', body: undefined }],
  commits: [{ headline: 'fix: things (#197)', body: 'Closes #5' }],
} as unknown as BranchSnapshot;
const repoFacts = { issues: [{ number: 40, title: 'bug' }], releases: [] } as unknown as RepoSnapshot;
const known = new Map([['OpenRAC', knownNumbers([branch], repoFacts)]]);

const report = (over: Partial<BranchReport>): BranchReport => ({
  date: '2026-11-01',
  repo: 'OpenRAC',
  branch: 'develop',
  headline: 'Faster tests',
  summary: 'Tests got faster in #198.',
  highlights: [],
  writtenBy: 'test',
  ...over,
});

test('references to anything in the snapshot pass', () => {
  assert.deepEqual([...knownNumbers([branch], repoFacts)].sort((a, b) => a - b), [5, 12, 40, 197, 198]);
  assert.deepEqual(checkBranchReport(report({ summary: 'See #198, #197, #12, #5, #40 and OpenRAC#198.' }), known), []);
});

test('an invented reference fails', () => {
  assert.match(checkBranchReport(report({ highlights: ['Merged #999.'] }), known).join(), /OpenRAC#999 isn't in this day's snapshot/);
});

test('URLs are rejected, whatever the text says about them', () => {
  assert.match(checkBranchReport(report({ summary: 'Download it at https://evil.example/x' }), known).join(), /contains a URL/);
});

test('markup is rejected in prose, but allowed inside a code span', () => {
  assert.match(checkBranchReport(report({ summary: 'Look <img src=x onerror=y> here' }), known).join(), /contains markup/);
  assert.match(checkBranchReport(report({ headline: '</p><script>x</script>' }), known).join(), /contains markup/);
  assert.deepEqual(checkBranchReport(report({ summary: 'Uses `vector<int>`, and 3 < 4 > 2 still reads fine.' }), known), []);
});

test('text for a feed is escaped, so a reader shows markup instead of running it', () => {
  assert.equal(toEscapedHtml('a <script>x</script>\n\nb & c'), '<p>a &lt;script&gt;x&lt;/script&gt;</p><p>b &amp; c</p>');
});

test('an overview must say which repo a reference belongs to', () => {
  const overview = (summary: string): Overview => ({ date: '2026-11-01', headline: 'h', summary, writtenBy: 'test' });
  assert.deepEqual(checkOverview(overview('Tests got faster, OpenRAC#198.'), known), []);
  assert.match(checkOverview(overview('Tests got faster, #198.'), known).join(), /doesn't say which repo/);
  assert.match(checkOverview(overview('Nothing here, rac9-decomp#1.'), known).join(), /isn't tracked/);
});

test('landings fall in their UTC hour, across the whole day', () => {
  const push = (at: string) => ({ at }) as Push;
  const hours = landingsByHour([push('2026-11-01T00:00:00Z'), push('2026-11-01T14:30:00Z'), push('2026-11-01T14:59:59Z'), push('2026-11-01T23:59:59Z')]);
  assert.equal(hours.length, 24);
  assert.equal(hours[0], 1);
  assert.equal(hours[14], 2);
  assert.equal(hours[23], 1);
  assert.match(describeHours(hours), /00:00 1, 14:00 2, 23:00 1/);
});

test('every landing is visible and busier hours are never dimmer', () => {
  const levels = [1, 2, 3, 4, 7, 8, 50].map(hourOpacity);
  assert.equal(hourOpacity(0), 0);
  assert.ok(levels.every((level) => level > 0));
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b));
});

test('progress figures read as openrac.dev shows them', () => {
  assert.equal(formatPercent({ done: 4684272, total: 5527936 }), '84.74%');
  assert.equal(formatPercent({ done: 0, total: 0 }), '0.00%');
  assert.equal(formatChange(0.314), '+0.31');
  assert.equal(formatChange(-0.02), '−0.02');
  assert.equal(formatChange(0.001), undefined);
  assert.equal(formatChange(-0.001), undefined);
});

test('a calendar month starts on the right weekday and fills out its weeks', () => {
  const [november] = calendarMonths('2026-11-01', '2026-11-30');
  assert.equal(november?.label, 'November 2026');
  // 1 November 2026 is a Sunday, the last column when weeks start on Monday.
  assert.deepEqual(november?.weeks[0], [null, null, null, null, null, null, '2026-11-01']);
  assert.equal(november?.weeks.at(-1)?.[0], '2026-11-30');
  assert.ok(november?.weeks.every((week) => week.length === 7));
  assert.equal(november?.weeks.flat().filter(Boolean).length, 30);
});

test('calendar months span the range, including across a new year', () => {
  assert.deepEqual(calendarMonths('2026-11-20', '2027-02-03').map((m) => m.id), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(calendarMonths('2026-10-03', '2026-10-31').map((m) => m.id), ['2026-10']);
  assert.equal(calendarMonths('2028-02-01', '2028-02-29')[0]?.weeks.flat().filter(Boolean).length, 29);
});

test('every active day is visible and busier days are never dimmer', () => {
  const levels = [1, 5, 6, 20, 21, 60, 61, 400].map(dayOpacity);
  assert.equal(dayOpacity(0), 0);
  assert.ok(levels.every((level) => level > 0));
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b));
});
