import { load } from 'cheerio';
import { parseDate } from './date';
import { clean, Parser, ScrapedItem, uniq } from './types';

/** WordPress KBoard 게시판 (GIST 물리·광과학과 등) */
export const kboardParser: Parser = {
  id: 'kboard',
  label: 'KBoard (워드프레스)',
  parse(html, ctx) {
    const $ = load(html);
    const out: ScrapedItem[] = [];
    for (const tr of $('.kboard-list tbody tr').toArray()) {
      const row = $(tr);
      const a = row.find('.kboard-list-title a').first();
      const href = a.attr('href');
      const uid = href && /[?&]uid=(\d+)/.exec(href)?.[1];
      if (!uid) continue;
      const url = new URL(href, ctx.baseUrl);
      url.search = `?uid=${uid}&mod=document`;
      const title = a.find('.kboard-default-cut-strings').length ? a.find('.kboard-default-cut-strings').first() : a;
      title.find('.kboard-comments-count').remove();
      out.push({
        externalId: uid,
        title: clean(title.text()),
        url: url.toString(),
        author: clean(row.find('td.kboard-list-user').text()) || undefined,
        postedAt: parseDate(clean(row.find('td.kboard-list-date').text()), ctx.tz),
      });
    }
    return uniq(out);
  },
};
