import { load } from 'cheerio';
import { clean, Parser, ScrapedItem } from './types';

/** RSS 2.0 / Atom 피드 */
export const rssParser: Parser = {
  id: 'rss',
  label: 'RSS·Atom 피드',
  parse(xml, ctx) {
    const $ = load(xml, { xml: true });
    const out: ScrapedItem[] = [];
    for (const el of $('item, entry').toArray()) {
      const e = $(el);
      const link = clean(e.children('link').first().attr('href') ?? e.children('link').first().text());
      if (!link) continue;
      const url = new URL(link, ctx.baseUrl).toString();
      const date = clean(e.children('pubDate, published, updated, dc\\:date').first().text());
      const d = date ? new Date(date) : undefined;
      out.push({
        externalId: clean(e.children('guid, id').first().text()) || url,
        title: clean(e.children('title').first().text()) || url,
        url,
        category: clean(e.children('category').first().text()) || undefined,
        author: clean(e.children('author, dc\\:creator').first().text()) || undefined,
        postedAt: d && !Number.isNaN(d.getTime()) ? d : undefined,
      });
    }
    return out;
  },
};
