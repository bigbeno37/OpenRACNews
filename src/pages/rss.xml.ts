import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { formatDay } from '../lib/days.ts';
import { dayUrl, url } from '../lib/links.ts';
import { dayFacts, loadDays } from '../lib/news.ts';
import { toEscapedHtml } from '../lib/prose.ts';

export async function GET(context: APIContext) {
  const days = await loadDays();
  return rss({
    title: 'OpenRAC News',
    description: 'A daily digest of the OpenRAC Ratchet & Clank decompilation projects, the launcher and the mods.',
    site: new URL(url('/'), context.site ?? 'http://localhost:4321').href,
    trailingSlash: true,
    items: days.slice(0, 60).map((day) => ({
      title: `${formatDay(day.date)}: ${day.overview?.headline ?? dayFacts(day)}`,
      pubDate: new Date(`${day.date}T23:59:59Z`),
      link: new URL(dayUrl(day.date), context.site ?? 'http://localhost:4321').href,
      description: toEscapedHtml(day.overview?.summary ?? `${dayFacts(day)}.`),
    })),
  });
}
