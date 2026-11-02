// Every internal link goes through here. On GitHub Pages a project site lives under /<repo>/, so a
// link written from the root would 404 there while working fine in local development.
//
// Every page but a few is about one day, so the date comes first: going back a day keeps you on the same
// project, and each page can be linked to as that day's snapshot.
import { branchSlug, repoUrl } from './tracking.ts';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const url = (path: string) => `${base}${path}`;

export const dayUrl = (date: string) => url(`/days/${date}/`);
export const projectUrl = (date: string, repo: string) => url(`/days/${date}/${repo}/`);
export const reportUrl = (repo: string, branch: string, date: string) => url(`/days/${date}/${repo}/${branchSlug(branch)}/`);

export const commitUrl = (repo: string, sha: string) => `${repoUrl(repo)}/commit/${sha}`;
export const pullUrl = (repo: string, number: number) => `${repoUrl(repo)}/pull/${number}`;
export const issueUrl = (repo: string, number: number) => `${repoUrl(repo)}/issues/${number}`;
export const releaseUrl = (repo: string, tag: string) => `${repoUrl(repo)}/releases/tag/${encodeURIComponent(tag)}`;
export const treeUrl = (repo: string, branch: string) => `${repoUrl(repo)}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`;
