import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { url, reportUrl } from '../lib/links.ts';
import { branchFacts, loadDays } from '../lib/news.ts';
import { toEscapedHtml } from '../lib/prose.ts';
import { themeFor } from '../lib/themes.ts';

/** One item per branch per day, tagged by project, so a reader can filter down to the games they follow. */
export async function GET(context: APIContext) {
  const site = context.site ?? 'http://localhost:4321';
  const days = await loadDays();
  const items = days.flatMap((day) =>
    day.branches.map(({ repo, branch, date, facts, report }) => {
      const { tag } = themeFor(repo.name);
      return {
        title: `${tag} ${branch.name}: ${report?.headline ?? branchFacts(facts)}`,
        pubDate: new Date(`${date}T23:59:59Z`),
        link: new URL(reportUrl(repo.name, branch.name, date), site).href,
        description: toEscapedHtml(report?.summary ?? `${branchFacts(facts)}.`),
        categories: [tag],
      };
    }),
  );
  return rss({
    title: 'OpenRAC News',
    description: 'What changed in each OpenRAC project: the Ratchet & Clank decompilations, the launcher and the mods.',
    site: new URL(url('/'), site).href,
    trailingSlash: true,
    items: items.slice(0, 100),
  });
}
