// Every internal link goes through here. On GitHub Pages a project site lives under /<repo>/, so a
// link written from the root would 404 there while working fine in local development.
import { branchSlug, repoUrl } from './tracking.ts';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const url = (path: string) => `${base}${path}`;

export const dayUrl = (date: string) => url(`/days/${date}/`);
export const projectUrl = (repo: string) => url(`/${repo}/`);
export const branchUrl = (repo: string, branch: string) => url(`/${repo}/#${branchSlug(branch)}`);
export const reportUrl = (repo: string, branch: string, date: string) => url(`/${repo}/${branchSlug(branch)}/${date}/`);

export const commitUrl = (repo: string, sha: string) => `${repoUrl(repo)}/commit/${sha}`;
export const pullUrl = (repo: string, number: number) => `${repoUrl(repo)}/pull/${number}`;
export const issueUrl = (repo: string, number: number) => `${repoUrl(repo)}/issues/${number}`;
export const releaseUrl = (repo: string, tag: string) => `${repoUrl(repo)}/releases/tag/${encodeURIComponent(tag)}`;
export const treeUrl = (repo: string, branch: string) => `${repoUrl(repo)}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`;
