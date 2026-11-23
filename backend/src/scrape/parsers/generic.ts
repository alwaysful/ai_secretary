import { type CheerioAPI, load } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { parseDate } from './date';
import { clean, Parser, ScrapedItem, uniq } from './types';

const ROW = 'tr, li, article, dl, .item, .list-item';
/** 정렬·페이지 파라미터 (글 고유 id 아님) */
const NOISE_PARAMS = /^(page|pageid|pageindex|gotopage|cpage|pg|p|sort|order|searchcnd|searchwrd|keyword|search|sca|sfl|stx)$/i;

function signature($: CheerioAPI, a: Element): string {
  const parts: string[] = [];
  let n: AnyNode | null = a;
  for (let i = 0; i < 4 && n && n.type === 'tag'; i++) {
    const el = n as Element;
    parts.push(`${el.tagName}.${($(el).attr('class') ?? '').trim().split(/\s+/).sort().join('.')}`);
    n = el.parent;
  }
  return parts.join('<');
}

function stableUrl(href: string, base: string): string {
  const u = new URL(href, base);
  for (const k of [...u.searchParams.keys()]) if (NOISE_PARAMS.test(k)) u.searchParams.delete(k);
  u.hash = '';
  return u.toString();
}

function itemOf($: CheerioAPI, a: Element, baseUrl: string, tz: string): ScrapedItem | null {
  const href = $(a).attr('href');
  if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return null;
  let url: string;
  try {
    url = stableUrl(href, baseUrl);
  } catch {
    return null;
  }
  if (!/^https?:/.test(url)) return null;
  const title = clean($(a).attr('title') && clean($(a).text()).length < 4 ? $(a).attr('title') : $(a).text());
  if (title.length < 4) return null;
  const row = $(a).closest(ROW);
  return { externalId: url, title: title.slice(0, 300), url, postedAt: parseDate(clean(row.text()), tz) };
}

/**
 * 범용 목록 파서. itemSelector 가 있으면 그 링크만,
 * 없으면 같은 구조로 반복되는 링크 묶음 중 가장 큰 것(≥3개)을 글 목록으로 본다.
 */
export const genericParser: Parser = {
  id: 'generic',
  label: '자동 감지 (범용)',
  parse(html, ctx) {
    const $ = load(html);
    $('header, footer, nav, script, style, .gnb, .lnb, #header, #footer').remove();
    if (ctx.itemSelector) {
      const els = $(ctx.itemSelector).toArray();
      const anchors = els.map((e) => (e.type === 'tag' && (e as Element).tagName === 'a' ? (e as Element) : $(e).find('a[href]').get(0))).filter((e): e is Element => !!e);
      return uniq(anchors.map((a) => itemOf($, a, ctx.baseUrl, ctx.tz)).filter((i): i is ScrapedItem => !!i));
    }
    const groups = new Map<string, Element[]>();
    for (const a of $('a[href]').toArray()) {
      if (!$(a).closest(ROW).length) continue;
      const t = clean($(a).text());
      if (t.length < 6 || t.length > 200) continue;
      const sig = signature($, a);
      groups.set(sig, [...(groups.get(sig) ?? []), a]);
    }
    // 날짜가 붙은 행이 많은 묶음 우선, 그다음 개수
    const score = (as: Element[]) =>
      as.length + 2 * as.filter((a) => parseDate(clean($(a).closest(ROW).text()), ctx.tz)).length;
    const best = [...groups.values()].filter((g) => g.length >= 3).sort((x, y) => score(y) - score(x))[0] ?? [];
    return uniq(best.map((a) => itemOf($, a, ctx.baseUrl, ctx.tz)).filter((i): i is ScrapedItem => !!i));
  },
};
