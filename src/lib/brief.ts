// A compact, complete view of a day's snapshot for whoever is writing its report. The snapshots run to
// tens of kilobytes of JSON, which agents tend to read in truncated chunks and so miss things. This keeps
// everything that matters to a report, says it once, and fits in one read.
import type { BranchSnapshot, Progress, RepoSnapshot } from './schema.ts';

const whole = new Intl.NumberFormat('en-GB');
const pct = ({ done, total }: { done: number; total: number }) => `${((100 * done) / total).toFixed(2)}%`;

function progressLine(progress: Progress, release?: string, previous?: { date: string; progress: Progress }): string {
  const parts = [`${pct(progress.code)} of code (${whole.format(progress.code.done)} of ${whole.format(progress.code.total)} bytes)`];
  if (progress.functions) parts.push(`${whole.format(progress.functions.done)} of ${whole.format(progress.functions.total)} functions`);
  if (progress.data) parts.push(`${pct(progress.data)} of data`);
  const before = previous ? ` Previously ${pct(previous.progress.code)} of code on ${previous.date}.` : '';
  return `Progress at the day's last commit${release ? `, measured on ${release} only` : ''}: ${parts.join(', ')}.${before}`;
}

const indent = (text: string) => text.replace(/\s*\n\s*/g, ' ').trim();

/** The pull request a commit came from, when its message says so: "fix: x (#12)" or "Merge pull request #12 from y". */
function pullRequestOf(headline: string): number | undefined {
  const match = /\(#(\d+)\)\s*$/.exec(headline) ?? /^Merge pull request #(\d+)/.exec(headline);
  return match ? Number(match[1]) : undefined;
}

export function renderBranchBrief(snapshot: BranchSnapshot, about: string, previous?: { date: string; progress: Progress }, release?: string): string {
  const { repo, branch, date, totals, pullRequests, commits, progress, warnings } = snapshot;
  const lines = [
    `${repo} ${branch}, ${date}`,
    `What this branch is: ${about}`,
    ...(progress ? [progressLine(progress, release, previous)] : []),
    `Totals: ${totals.commits} commits and ${totals.merges} merges. ${totals.landed} landed directly on the branch, adding ${whole.format(totals.additions)} lines and removing ${whole.format(totals.deletions)}. By: ${totals.authors.join(', ') || 'nobody'}.`,
    ...(totals.forcePushes ? [`History was rewritten ${totals.forcePushes} times.`] : []),
    ...warnings.map((warning) => `Warning: ${warning}`),
  ];

  lines.push('', `Pull requests (${pullRequests.length}):`);
  for (const pr of pullRequests) {
    const state = [...pr.events, ...(pr.draft ? ['draft'] : [])].join(', ');
    lines.push(`#${pr.number} [${state}] by ${pr.author}, +${pr.additions} -${pr.deletions} in ${pr.changedFiles} files: ${pr.title}`);
    if (pr.body) lines.push(`  ${indent(pr.body)}`);
  }

  // A commit that came from a pull request listed above would mostly repeat it, so only its headline is kept.
  const listed = new Set(pullRequests.map((pr) => pr.number));
  const landed = commits.filter((commit) => commit.landed);
  lines.push('', `Commits that landed on the branch, oldest first (${landed.length}):`);
  for (const commit of landed) {
    const size = commit.additions === undefined ? '' : ` +${commit.additions} -${commit.deletions}`;
    lines.push(`${commit.sha.slice(0, 7)} by ${commit.author}${size}: ${commit.headline}`);
    const fromListed = pullRequestOf(commit.headline);
    if (commit.body && !(fromListed && listed.has(fromListed))) lines.push(`  ${indent(commit.body)}`);
  }

  const brought = [...new Set(commits.filter((commit) => !commit.landed && !commit.merge).map((commit) => commit.headline))];
  if (brought.length > 0) {
    lines.push('', `Other commits, brought in by those merges (${brought.length}):`);
    for (const headline of brought) lines.push(`- ${headline}`);
  }
  return lines.join('\n');
}

export function renderRepoBrief(snapshot: RepoSnapshot): string {
  const lines = [`${snapshot.repo} issues and releases, ${snapshot.date}`];
  if (snapshot.releases.length > 0) {
    lines.push('', `Releases (${snapshot.releases.length}):`);
    for (const release of snapshot.releases) {
      lines.push(`${release.tag}${release.name ? ` (${release.name})` : ''}${release.prerelease ? ' [prerelease]' : ''}`);
      if (release.body) lines.push(`  ${indent(release.body)}`);
    }
  }
  if (snapshot.issues.length > 0) {
    lines.push('', `Issues (${snapshot.issues.length}):`);
    for (const issue of snapshot.issues) {
      lines.push(`#${issue.number} [${issue.events.join(', ')}${issue.closedAs ? `, ${issue.closedAs}` : ''}] by ${issue.author}: ${issue.title}`);
      if (issue.body) lines.push(`  ${indent(issue.body)}`);
    }
  }
  return lines.join('\n');
}
