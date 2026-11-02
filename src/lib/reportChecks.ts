// Checks on what agents write that a schema can't express. Above all, a report may only cite things
// that are really in that day's snapshot, which catches invented pull request numbers before they
// reach readers. These checks are mechanical, so they can't be talked out of it by anything an agent
// was persuaded of while reading.
import { referencesIn, tokenize } from './prose.ts';
import type { BranchReport, BranchSnapshot, Overview, RepoSnapshot } from './schema.ts';

const URL_LIKE = /\bhttps?:\/\//i;
const TAG_LIKE = /<\/?[a-z!][^>]*>/i;

/** The text with its code spans taken out: `vector<int>` belongs in one, a bare <img> doesn't. */
const outsideCode = (text: string) =>
  tokenize(text)
    .map((token) => (token.kind === 'code' ? '' : token.text))
    .join('');

/** The issue and pull request numbers a repo's snapshots for one day mention anywhere. */
export function knownNumbers(branches: BranchSnapshot[], repo: RepoSnapshot | undefined): Set<number> {
  const known = new Set<number>();
  const mentions = (text: string | undefined) => {
    for (const { number } of referencesIn(text ?? '')) known.add(number);
  };
  for (const branch of branches) {
    for (const pr of branch.pullRequests) {
      known.add(pr.number);
      mentions(pr.title);
      mentions(pr.body);
    }
    for (const commit of branch.commits) {
      mentions(commit.headline);
      mentions(commit.body);
    }
  }
  for (const issue of repo?.issues ?? []) {
    known.add(issue.number);
    mentions(issue.title);
    mentions(issue.body);
  }
  for (const release of repo?.releases ?? []) mentions(release.body);
  return known;
}

function checkText(text: string, ownRepo: string | null, known: Map<string, Set<number>>): string[] {
  const errors: string[] = [];
  if (URL_LIKE.test(text)) errors.push(`contains a URL, which reports must not: "${text.slice(0, 60)}"`);
  if (TAG_LIKE.test(outsideCode(text))) errors.push(`contains markup, which reports must not: "${text.slice(0, 60)}"`);
  for (const { repo, number } of referencesIn(text)) {
    const target = repo ?? ownRepo;
    if (!target) errors.push(`#${number} doesn't say which repo it means; write it as repo#${number}`);
    else if (!known.has(target)) errors.push(`${repo}#${number} names a repo that isn't tracked or had no activity`);
    else if (!known.get(target)?.has(number)) errors.push(`${target}#${number} isn't in this day's snapshot`);
  }
  return errors;
}

export function checkBranchReport(report: BranchReport, known: Map<string, Set<number>>): string[] {
  return [report.headline, report.summary, ...report.highlights].flatMap((text) => checkText(text, report.repo, known));
}

export function checkOverview(overview: Overview, known: Map<string, Set<number>>): string[] {
  return [overview.headline, overview.summary].flatMap((text) => checkText(text, null, known));
}
