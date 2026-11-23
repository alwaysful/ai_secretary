import { load } from 'cheerio';
import { startOfLocalDay } from '../../calendar/tz';
import { clean, ScrapedItem, ScrapeSource } from './source';

/** GIST 학사공지 게시판. 서버 렌더링 표 (.bd_list_wrap table) */
export const gistAcademic: ScrapeSource = {
  id: 'gist-academic',
  name: 'GIST 학사공지',
  kind: 'notice',
  homeUrl: 'https://www.gist.ac.kr/kr/html/sub05/050209.html',
  listUrl: 'https://www.gist.ac.kr/kr/html/sub05/050209.html',
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
      const date = /(\d{4})-(\d{2})-(\d{2})/.exec(clean(row.find('td.reg_date').text()));
      // 페이지 번호(GotoPage) 빼고 고정 URL
      const url = new URL(ctx.baseUrl);
      url.search = `?mode=V&no=${no}`;
      out.push({
        externalId: no,
        title: clean(a.text()),
        url: url.toString(),
        category: clean(row.find('td.category').text()) || undefined,
        author: clean(row.find('td.wrt').text()) || undefined,
        postedAt: date ? startOfLocalDay(+date[1], +date[2], +date[3], ctx.tz) : undefined,
      });
    }
    // 같은 글이 상단 고정 + 일반 목록에 두 번 나올 수 있음
    return [...new Map(out.map((i) => [i.externalId, i])).values()];
  },
};
