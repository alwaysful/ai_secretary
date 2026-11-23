import { contestkoreaParser } from './contestkorea';
import { egovParser } from './egov';
import { genericParser } from './generic';
import { gistParser } from './gist';
import { kboardParser } from './kboard';
import { linkareerParser } from './linkareer';
import { rssParser } from './rss';
import { ParseCtx, Parser, ScrapedItem } from './types';
import { wevityParser } from './wevity';

export const PARSERS: readonly Parser[] = [gistParser, kboardParser, egovParser, rssParser, wevityParser, linkareerParser, contestkoreaParser, genericParser];
export const PARSER_IDS = ['auto', ...PARSERS.map((p) => p.id)] as const;

/** HTML 생김새로 파서 고르기 */
export function detectParser(html: string, url: string): Parser {
  const head = html.slice(0, 500).trimStart();
  if (/^<\?xml|^<rss|^<feed/i.test(head) || /<rss[\s>]|<feed[\s>]/i.test(head)) return rssParser;
  if (/class="[^"]*kboard-list/.test(html)) return kboardParser;
  if (/bd_list_wrap|id="BBSList\d+"/.test(html)) return gistParser;
  if (/fn_search_detail\(/.test(html)) return egovParser;
  if (/linkareer\.com/i.test(url) && html.includes('__NEXT_DATA__')) return linkareerParser;
  if (/wevity\.com/i.test(url)) return wevityParser;
  if (/contestkorea\.com/i.test(url)) return contestkoreaParser;
  return genericParser;
}

/** parserId 'auto' → 감지. itemSelector 가 있으면 범용 파서 강제 */
export function runParser(parserId: string, html: string, ctx: ParseCtx): { parser: Parser; items: ScrapedItem[] } {
  const parser = ctx.itemSelector
    ? genericParser
    : parserId === 'auto'
      ? detectParser(html, ctx.baseUrl)
      : PARSERS.find((p) => p.id === parserId) ?? genericParser;
  return { parser, items: parser.parse(html, ctx) };
}

export * from './types';
export { parseDate, parseDday, parsePeriod } from './date';
