// Tooling for the agents that write reports. See AGENTS.md.
//
//   pnpm --silent reports:todo         what still needs writing, for days within `lookbackDays`
//   pnpm --silent reports:todo --all   the same across every day on record
//   pnpm --silent reports:todo --date 2026-11-01   the same for one day
//   pnpm --silent reports:brief data/2026-11-01/branches/OpenRAC__develop.json   a snapshot, compact, to write from
//   pnpm --silent reports:check        validates everything written so far
//   pnpm --silent reports:check --prune   as above, then deletes whatever failed
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { renderBranchBrief, renderRepoBrief } from '../src/lib/brief.ts';
import { recentDays } from '../src/lib/days.ts';
import { checkBranchReport, checkOverview, knownNumbers } from '../src/lib/reportChecks.ts';
import type { BranchSnapshot, RepoSnapshot } from '../src/lib/schema.ts';
import { branchReportSchema, branchSnapshotSchema, overviewSchema, repoSnapshotSchema } from '../src/lib/schema.ts';
import { branchKey, tracking, trackedBranches } from '../src/lib/tracking.ts';

const DATA_DIR = 'data';

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const listJson = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []);
const allDays = () =>
  existsSync(DATA_DIR)
    ? readdirSync(DATA_DIR)
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
    : [];

/** Prints a snapshot as a compact brief for writing from. */
function brief(path: string | undefined) {
  if (!path || !existsSync(path)) {
    console.error(`No snapshot at ${path ?? '(no path given)'}. Pass a file under data/<date>/branches/ or data/<date>/repos/.`);
    process.exitCode = 2;
    return;
  }
  if (path.includes('/repos/')) {
    console.log(renderRepoBrief(repoSnapshotSchema.parse(readJson(path))));
    return;
  }
  const snapshot = branchSnapshotSchema.parse(readJson(path));
  const tracked = trackedBranches().find(({ repo, branch }) => repo.name === snapshot.repo && branch.name === snapshot.branch);
  // The newest earlier figures, so the brief can say how far they moved.
  const file = `${branchKey(snapshot.repo, snapshot.branch)}.json`;
  const previous = allDays()
    .filter((day) => day < snapshot.date)
    .reverse()
    .flatMap((day) => {
      const earlier = join(DATA_DIR, day, 'branches', file);
      const progress = existsSync(earlier) ? branchSnapshotSchema.parse(readJson(earlier)).progress : undefined;
      return progress ? [{ date: day, progress }] : [];
    })[0];
  console.log(renderBranchBrief(snapshot, tracked?.branch.about ?? '', previous, tracked?.repo.progressRelease));
}

function todo(everyDay: boolean, onlyDate?: string) {
  const window = new Set(recentDays(tracking.lookbackDays));
  const days = allDays().filter((day) => (onlyDate ? day === onlyDate : everyDay || window.has(day)));
  const lines: string[] = [];
  for (const day of days) {
    const dir = join(DATA_DIR, day);
    for (const { repo, branch } of trackedBranches()) {
      const key = branchKey(repo.name, branch.name);
      const facts = join(dir, 'branches', `${key}.json`);
      const report = join(dir, 'reports', `${key}.json`);
      if (existsSync(facts) && !existsSync(report)) lines.push(`${report}  from  ${facts}`);
    }
    if (!existsSync(join(dir, 'overview.json')) && (listJson(join(dir, 'branches')).length || listJson(join(dir, 'repos')).length)) {
      lines.push(`${join(dir, 'overview.json')}  last, from every report and data/${day}/repos/*.json`);
    }
  }
  console.log(lines.length ? lines.join('\n') : 'Nothing to write.');
}

function knownForDay(day: string): Map<string, Set<number>> {
  const known = new Map<string, Set<number>>();
  for (const repo of tracking.repos) {
    const branches = repo.branches.flatMap((branch): BranchSnapshot[] => {
      const path = join(DATA_DIR, day, 'branches', `${branchKey(repo.name, branch.name)}.json`);
      return existsSync(path) ? [branchSnapshotSchema.parse(readJson(path))] : [];
    });
    const repoPath = join(DATA_DIR, day, 'repos', `${repo.name}.json`);
    const repoFacts: RepoSnapshot | undefined = existsSync(repoPath) ? repoSnapshotSchema.parse(readJson(repoPath)) : undefined;
    if (branches.length || repoFacts) known.set(repo.name, knownNumbers(branches, repoFacts));
  }
  return known;
}

function issuesIn(path: string, day: string, known: Map<string, Set<number>>): string[] {
  let raw: unknown;
  try {
    raw = readJson(path);
  } catch (error) {
    return [`isn't valid JSON: ${(error as Error).message}`];
  }
  const isOverview = path.endsWith('overview.json');
  const parsed = isOverview ? overviewSchema.safeParse(raw) : branchReportSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.') || 'file'}: ${i.message}`);
  const errors: string[] = [];
  if (parsed.data.date !== day) errors.push(`date says ${parsed.data.date} but the file is under ${day}`);
  if (isOverview) return [...errors, ...checkOverview(overviewSchema.parse(raw), known)];

  const report = branchReportSchema.parse(raw);
  const key = branchKey(report.repo, report.branch);
  if (!path.endsWith(`/${key}.json`)) errors.push(`repo and branch say ${key} but the file name doesn't`);
  if (!trackedBranches().some(({ repo, branch }) => repo.name === report.repo && branch.name === report.branch)) {
    errors.push(`${report.repo} ${report.branch} isn't in config/tracking.json`);
  }
  return [...errors, ...checkBranchReport(report, known)];
}

function check(prune: boolean) {
  let failed = 0;
  let checked = 0;
  for (const day of allDays()) {
    const known = knownForDay(day);
    const reportDir = join(DATA_DIR, day, 'reports');
    const paths = listJson(reportDir).map((file) => join(reportDir, file));
    if (existsSync(join(DATA_DIR, day, 'overview.json'))) paths.push(join(DATA_DIR, day, 'overview.json'));
    for (const path of paths) {
      checked++;
      const errors = issuesIn(path, day, known);
      if (errors.length === 0) continue;
      failed++;
      console.error(`${path}\n${errors.map((e) => `  - ${e}`).join('\n')}`);
      if (prune) {
        rmSync(path);
        console.error('  deleted');
      }
    }
  }
  console.log(`${checked} checked, ${failed} failed${prune && failed ? ' and deleted' : ''}.`);
  if (failed && !prune) process.exitCode = 1;
}

const [command, ...flags] = process.argv.slice(2);
if (command === 'todo') {
  const dateFlag = flags.indexOf('--date');
  todo(flags.includes('--all'), dateFlag >= 0 ? flags[dateFlag + 1] : undefined);
} else if (command === 'check') check(flags.includes('--prune'));
else if (command === 'brief') brief(flags[0]);
else {
  console.error('Usage: reports.ts todo [--all | --date YYYY-MM-DD] | check [--prune] | brief <snapshot file>');
  process.exitCode = 2;
}
