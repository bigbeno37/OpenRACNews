// config/tracking.json decides what this site covers. Everything goes through here, so the snapshot
// script, the site and the agents can't disagree about which branches count.
import raw from '../../config/tracking.json' with { type: 'json' };
import { trackingSchema } from './schema.ts';

export const tracking = trackingSchema.parse(raw);

/** A branch's name in file names and URLs. Branch names may contain slashes; these can't. */
export function branchSlug(branch: string): string {
  return branch.replaceAll('/', '--');
}

export function branchKey(repo: string, branch: string): string {
  return `${repo}__${branchSlug(branch)}`;
}

export function isTracked(repo: string, branch?: string): boolean {
  const found = tracking.repos.find((r) => r.name === repo);
  if (!found) return false;
  return branch === undefined || found.branches.some((b) => b.name === branch);
}

export function trackedBranches() {
  return tracking.repos.flatMap((repo) => repo.branches.map((branch) => ({ repo, branch })));
}

export const repoUrl = (repo: string) => `https://github.com/${tracking.org}/${repo}`;
