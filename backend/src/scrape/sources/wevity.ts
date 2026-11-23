import { load } from 'cheerio';
import { localParts, startOfLocalDay } from '../../calendar/tz';
import { clean, ScrapedItem, ScrapeSource } from './source';

const DAY = 86_400_000;

/** "D-8" → 오늘+8일, "D-day"/"오늘마감" → 오늘. 마감·없음 → undefined */
export function parseDday(text: string, now: Date, tz: string): Date | undefined {
  const t = localParts(now, tz);
  const today = startOfLocalDay(t.year, t.month, t.day, tz);
  if (/d-?day|오늘\s*마감/i.test(text)) return today;
  const m = /D-(\d{1,3})\b/i.exec(text);
  return m ? new Date(today.getTime() + Number(m[1]) * DAY) : undefined;
}

/** 위비티 공모전 목록 (최신순 1페이지). robots.txt: Allow / */
export const wevity: ScrapeSource = {
  id: 'wevity',
  name: '위비티 공모전',
  kind: 'contest',
  homeUrl: 'https://www.wevity.com/?c=find&s=1',
  listUrl: 'https://www.wevity.com/?c=find&s=1&gub=1',
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
};
