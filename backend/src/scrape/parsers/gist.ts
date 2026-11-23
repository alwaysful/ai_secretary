import { load } from 'cheerio';
import { parseDate } from './date';
import { clean, Parser, ScrapedItem, uniq } from './types';

/** www.gist.ac.kr 게시판 (학사공지·공지사항 등). 서버 렌더링 표 */
export const gistParser: Parser = {
  id: 'gist',
  label: 'GIST 본교 게시판',
  parse(html, ctx) {
    const $ = load(html);
    const out: ScrapedItem[] = [];
    for (const tr of $('.bd_list_wrap tbody tr, table tbody tr[id^="BBSList"]').toArray()) {
      const row = $(tr);
      const a = row.find('td.title a').first();
      const href = a.attr('href');
      if (!href) continue;
      const no = /[?&]no=(\d+)/.exec(href)?.[1] ?? /BBSList(\d+)/.exec(row.attr('id') ?? '')?.[1];
      if (!no) continue;
      // 페이지 번호(GotoPage) 빼고 고정 URL
      const url = new URL(ctx.baseUrl);
      url.search = `?mode=V&no=${no}`;
      out.push({
        externalId: no,
        title: clean(a.text()),
        url: url.toString(),
        category: clean(row.find('td.category').text()) || undefined,
        author: clean(row.find('td.wrt').text()) || undefined,
        postedAt: parseDate(clean(row.find('td.reg_date').text()), ctx.tz),
      });
    }
    return uniq(out);
  },
};
