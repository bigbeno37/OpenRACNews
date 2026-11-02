// Who worked on a branch on one day, and where GitHub shows that work. GitHub has no single page for
// "everything this person did here on this day", so each person links to whichever page shows it best:
//
// - Someone with a pull request that day goes to a search for that person's pull requests, opened or closed
//   that day against the branch. It's exact, and it's the only page that shows work not merged yet.
// - Someone with only commits goes to the branch's commits. GitHub filters those by the date written in the
//   commit, while a commit here belongs to the day it landed, so the range starts at the person's earliest
//   commit, or the page could come up empty.
import { dayOf } from './days.ts';
import type { BranchSnapshot } from './schema.ts';
import { repoUrl } from './tracking.ts';

export interface Contributor {
  name: string;
  /** Absent for a commit's author with no GitHub account, who has neither a page nor a picture. */
  href?: string;
  /** Absent for an app, whose picture GitHub doesn't serve from a login. */
  avatar?: string;
}

const LOGIN = /^[a-z\d](?:[a-z\d-]{0,38})(?:\[bot\])?$/i;
const APP_SUFFIX = /\[bot\]$/;

const isApp = (login: string) => APP_SUFFIX.test(login);
/** GitHub's search names an app differently to everywhere else. */
const searchName = (login: string) => (isApp(login) ? `app/${login.replace(APP_SUFFIX, '')}` : login);

export const pullsByUrl = (repo: string, branch: string, login: string, date: string) =>
  `${repoUrl(repo)}/pulls?q=${encodeURIComponent(`is:pr author:${searchName(login)} base:${branch} (created:${date} OR closed:${date})`)}`;

export const commitsByUrl = (repo: string, branch: string, login: string, since: string, until: string) =>
  `${repoUrl(repo)}/commits/${branch.split('/').map(encodeURIComponent).join('/')}/?${new URLSearchParams({ author: login, since, until })}`;

/** Everyone with a commit or pull request on this branch on this day, busiest first. */
export function contributorsOn(repo: string, facts: BranchSnapshot): Contributor[] {
  const { branch, date } = facts;
  const people = new Map<string, { work: number; pulls: boolean; since: string; linked: boolean }>();
  const person = (name: string) => {
    if (!people.has(name)) people.set(name, { work: 0, pulls: false, since: date, linked: false });
    return people.get(name)!;
  };
  for (const commit of facts.commits) {
    const entry = person(commit.author);
    entry.work += 1;
    const written = dayOf(commit.committedAt);
    if (written < entry.since) entry.since = written;
    // Names in older snapshots aren't marked, but a name with a space can't be a login.
    if (!commit.unlinked && LOGIN.test(commit.author)) entry.linked = true;
  }
  for (const pullRequest of facts.pullRequests) {
    const entry = person(pullRequest.author);
    entry.work += 1;
    entry.pulls = true;
    // A pull request is always by an account, even if the same name also signs a commit with no account.
    entry.linked = true;
  }
  return [...people]
    .sort(([, a], [, b]) => b.work - a.work)
    .map(([name, { pulls, since, linked }]) => ({
      name,
      ...(linked ? { href: pulls ? pullsByUrl(repo, branch, name, date) : commitsByUrl(repo, branch, name, since, date) } : {}),
      ...(linked && !isApp(name) ? { avatar: `https://github.com/${name}.png?size=56` } : {}),
    }));
}
