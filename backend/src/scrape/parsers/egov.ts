import { load } from 'cheerio';
import { parseDate } from './date';
import { clean, Parser, ScrapedItem, uniq } from './types';

const DETAIL = /fn_search_detail\(\s*'([^']+)'/;

/** 전자정부프레임워크 bbsArticle 게시판 (GIST AI학과 등). 목록 URL .../{bbsId}/list.do → 글 .../{bbsId}/{nttId}/view.do */
export const egovParser: Parser = {
  id: 'egov',
  label: '전자정부 게시판 (bbsArticle)',
  parse(html, ctx) {
    const $ = load(html);
    const base = new URL(ctx.baseUrl);
    const dir = base.pathname.replace(/\/[^/]*$/, ''); // .../list.do 제거
    const out: ScrapedItem[] = [];
    for (const tr of $('tbody tr').toArray()) {
      const row = $(tr);
      const a = row.find('td.subject a, td[data-cell-header="제목"] a').first();
      const id = DETAIL.exec(a.attr('onclick') ?? '')?.[1] ?? /\/(B\w+)\/view\.do/.exec(a.attr('href') ?? '')?.[1];
      if (!id) continue;
      const dateCell = row.find('td[data-cell-header="Date"], td[data-cell-header="등록일"], td[data-cell-header="작성일"]').text();
      out.push({
        externalId: id,
        title: clean(a.text()),
        url: new URL(`${dir}/${id}/view.do`, base).toString(),
        author: clean(row.find('td[data-cell-header="작성자"]').text()) || undefined,
        postedAt: parseDate(clean(dateCell) || clean(row.text()), ctx.tz),
      });
    }
    return uniq(out);
  },
};
