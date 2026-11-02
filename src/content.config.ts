import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { branchReportSchema, branchSnapshotSchema, overviewSchema, repoSnapshotSchema } from './lib/schema.ts';

const fromData = (pattern: string) => glob({ base: './data', pattern, generateId: ({ entry }) => entry });

export const collections = {
  branchSnapshots: defineCollection({ loader: fromData('*/branches/*.json'), schema: branchSnapshotSchema }),
  repoSnapshots: defineCollection({ loader: fromData('*/repos/*.json'), schema: repoSnapshotSchema }),
  branchReports: defineCollection({ loader: fromData('*/reports/*.json'), schema: branchReportSchema }),
  overviews: defineCollection({ loader: fromData('*/overview.json'), schema: overviewSchema }),
};
