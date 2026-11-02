// The shapes of everything under config/ and data/. The site, the scripts and the agents' checks all
// validate against these, so a file that passes here will also build.
import { z } from 'astro/zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const trackingSchema = z.strictObject({
  org: z.string().min(1),
  /** How many finished UTC days each snapshot run revisits, to catch up after a missed run. */
  lookbackDays: z.number().int().min(1).max(30),
  repos: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        title: z.string().min(1),
        about: z.string().min(1),
        branches: z
          .array(
            z.strictObject({
              name: z.string().min(1),
              /** What this branch is for. Agents use it to frame their reports; the site shows it. */
              about: z.string().min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});
export type Tracking = z.infer<typeof trackingSchema>;
export type TrackedRepo = Tracking['repos'][number];
export type TrackedBranch = TrackedRepo['branches'][number];

export const pushSchema = z.strictObject({
  at: z.string(),
  type: z.string(),
  actor: z.string().nullable(),
  before: z.string(),
  after: z.string(),
});
export type Push = z.infer<typeof pushSchema>;

export const commitSchema = z.strictObject({
  sha: z.string(),
  headline: z.string(),
  author: z.string(),
  committedAt: z.string(),
  merge: z.boolean(),
  /** On the branch's first-parent line: it is what the branch itself gained, not a commit merged in. */
  landed: z.boolean(),
  /** Landed commits only. A merged-in commit's own diff would count the same lines twice. */
  additions: z.number().int().optional(),
  deletions: z.number().int().optional(),
  /** Landed commits only, cut to length. */
  body: z.string().optional(),
});
export type Commit = z.infer<typeof commitSchema>;

export const pullRequestEventSchema = z.enum(['opened', 'merged', 'closed']);
export type PullRequestEvent = z.infer<typeof pullRequestEventSchema>;

export const pullRequestSchema = z.strictObject({
  number: z.number().int(),
  title: z.string(),
  author: z.string(),
  draft: z.boolean(),
  head: z.string(),
  /** What happened to it on this day, in the order it happened. */
  events: z.array(pullRequestEventSchema).min(1),
  mergedBy: z.string().nullable(),
  additions: z.number().int(),
  deletions: z.number().int(),
  changedFiles: z.number().int(),
  body: z.string().optional(),
});
export type PullRequest = z.infer<typeof pullRequestSchema>;

const ratioSchema = z.strictObject({ done: z.number(), total: z.number() });

/**
 * How far a decompilation had got: its own objdiff report (progress/report.json) as it stood at the
 * day's last commit. `code` is the honest figure, weighted by size, as on openrac.dev.
 */
export const progressSchema = z.strictObject({
  sha: z.string(),
  code: ratioSchema,
  functions: ratioSchema.nullable(),
  data: ratioSchema.nullable(),
});
export type Progress = z.infer<typeof progressSchema>;
export type Ratio = z.infer<typeof ratioSchema>;

export const branchSnapshotSchema = z.strictObject({
  date: day,
  repo: z.string(),
  branch: z.string(),
  capturedAt: z.string(),
  /** Null when this commit has no report. Absent on a day nothing landed, when there's no new commit to read it from. */
  progress: progressSchema.nullable().optional(),
  totals: z.strictObject({
    commits: z.number().int(),
    merges: z.number().int(),
    landed: z.number().int(),
    additions: z.number().int(),
    deletions: z.number().int(),
    pushes: z.number().int(),
    forcePushes: z.number().int(),
    authors: z.array(z.string()),
  }),
  warnings: z.array(z.string()),
  pushes: z.array(pushSchema),
  pullRequests: z.array(pullRequestSchema),
  commits: z.array(commitSchema),
});
export type BranchSnapshot = z.infer<typeof branchSnapshotSchema>;

export const issueSchema = z.strictObject({
  number: z.number().int(),
  title: z.string(),
  author: z.string(),
  events: z.array(z.enum(['opened', 'closed'])).min(1),
  closedAs: z.string().nullable(),
  body: z.string().optional(),
});
export type Issue = z.infer<typeof issueSchema>;

export const releaseSchema = z.strictObject({
  tag: z.string(),
  name: z.string().nullable(),
  prerelease: z.boolean(),
  publishedAt: z.string(),
  author: z.string().nullable(),
  body: z.string().optional(),
});
export type Release = z.infer<typeof releaseSchema>;

/** Things that belong to a repository rather than to any one of its branches. */
export const repoSnapshotSchema = z.strictObject({
  date: day,
  repo: z.string(),
  capturedAt: z.string(),
  issues: z.array(issueSchema),
  releases: z.array(releaseSchema),
});
export type RepoSnapshot = z.infer<typeof repoSnapshotSchema>;

const prose = (max: number) => z.string().trim().min(1).max(max);

/** Written by an agent, one per tracked branch per active day. See AGENTS.md. */
export const branchReportSchema = z.strictObject({
  date: day,
  repo: z.string(),
  branch: z.string(),
  headline: prose(110),
  summary: prose(1100),
  highlights: z.array(prose(260)).max(6),
  writtenBy: prose(60),
});
export type BranchReport = z.infer<typeof branchReportSchema>;

/** Written by an agent, one per active day, across every branch. See AGENTS.md. */
export const overviewSchema = z.strictObject({
  date: day,
  headline: prose(110),
  summary: prose(1300),
  writtenBy: prose(60),
});
export type Overview = z.infer<typeof overviewSchema>;
