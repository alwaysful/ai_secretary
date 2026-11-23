import { load } from 'cheerio';
import { parseDday, parsePeriod } from './date';
import { clean, Parser, ScrapedItem } from './types';

/** 위비티 공모전 목록. robots.txt: Allow / */
export const wevityParser: Parser = {
  id: 'wevity',
  label: '위비티',
  parse(html, ctx) {
    const $ = load(html);
    const out: ScrapedItem[] = [];
    for (const li of $('ul.list li').toArray()) {
      const row = $(li);
      const a = row.find('.tit > a').first();
      const href = a.attr('href');
      const ix = href && /[?&]ix=(\d+)/.exec(href)?.[1];
      if (!ix) continue;
      a.find('span').remove(); // SPECIAL·IDEA 배지
      const url = new URL(ctx.baseUrl);
      url.search = `?c=find&s=1&gbn=view&ix=${ix}`;
      out.push({
        externalId: ix,
        title: clean(a.text()),
        url: url.toString(),
        category: clean(row.find('.sub-tit').text()).replace(/^분야\s*:\s*/, '') || undefined,
        author: clean(row.find('.organ').text()) || undefined,
        deadline: parseDday(clean(row.find('.day').text()), ctx.now, ctx.tz),
      });
    }
    return out;
  },
  parseDetail(html, ctx) {
    const $ = load(html);
    return parsePeriod(clean($('li.dday-area').text() || $('body').text()), ctx.tz);
  },
};
