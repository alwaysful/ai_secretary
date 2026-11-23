import { load } from 'cheerio';
import { localParts, startOfLocalDay } from '../../calendar/tz';
import { clean, Parser, ScrapedItem } from './types';

const DAY = 86_400_000;

/** "11.13~12.31" (연도 없음) → 시작·마감. 연도는 오늘 기준 가장 가까운 해, 마감<시작이면 다음 해 */
export function parseShortPeriod(text: string, now: Date, tz: string): { startsAt?: Date; deadline?: Date } {
  const m = /(\d{1,2})\.(\d{1,2})\s*~\s*(\d{1,2})\.(\d{1,2})/.exec(text);
  if (!m) return {};
  const t = localParts(now, tz);
  const [sm, sd, em, ed] = m.slice(1).map(Number);
  // 시작월이 지금보다 6개월 넘게 뒤면 작년 글
  let sy = t.year;
  if (sm - t.month > 6) sy--;
  else if (t.month - sm > 6) sy++;
  const ey = em < sm || (em === sm && ed < sd) ? sy + 1 : sy;
  return { startsAt: startOfLocalDay(sy, sm, sd, tz), deadline: new Date(startOfLocalDay(ey, em, ed, tz).getTime() + DAY - 1) };
}

/** "01.25" 하루 → 그날 끝 */
function shortDay(text: string, ref: Date | undefined, now: Date, tz: string): Date | undefined {
  const m = /(\d{1,2})\.(\d{1,2})/.exec(text);
  if (!m) return undefined;
  const p = parseShortPeriod(`${m[1]}.${m[2]}~${m[1]}.${m[2]}`, ref ?? now, tz);
  if (p.deadline && ref && p.deadline < ref) p.deadline = new Date(p.deadline.getTime() + 365 * DAY);
  return p.deadline;
}

/** 콘테스트코리아 목록 (/sub/list.php). 접수기간이 목록에 있음. robots.txt: Allow / */
export const contestkoreaParser: Parser = {
  id: 'contestkorea',
  label: '콘테스트코리아',
  parse(html, ctx) {
    const $ = load(html);
    const out: ScrapedItem[] = [];
    for (const li of $('li').toArray()) {
      const row = $(li);
      const a = row.children('.title').find('a[href*="view.php"]').first();
      const href = a.attr('href');
      const no = href && /[?&]str_no=(\w+)/.exec(href)?.[1];
      if (!no) continue;
      const url = new URL(href!, ctx.baseUrl);
      for (const k of [...url.searchParams.keys()]) if (!['int_gbn', 'Txt_bcode', 'str_no'].includes(k)) url.searchParams.delete(k);
      const host = clean(row.find('.host .icon_1').text()).replace(/^주최\s*\.?\s*/, '');
      const target = clean(row.find('.host .icon_2').text()).replace(/^대상\s*\.?\s*/, '').replace(/\s*,\s*/g, ', ').replace(/\s*▶$/, '');
      const apply = parseShortPeriod(clean(row.find('.date .step-1').text()), ctx.now, ctx.tz);
      // 진행 = 심사 시작 ~ 발표 (없으면 심사 끝)
      const judge = parseShortPeriod(clean(row.find('.date .step-2').text()), apply.startsAt ?? ctx.now, ctx.tz);
      const announce = shortDay(clean(row.find('.date .step-3').text()), judge.startsAt ?? apply.deadline, ctx.now, ctx.tz);
      out.push({
        externalId: no,
        title: clean(a.find('.txt').text() || a.text()),
        url: url.toString(),
        category: clean(a.find('.category').text()).replace(/•/g, '/') || undefined,
        author: host || undefined,
        ...apply,
        eventStartsAt: judge.startsAt,
        eventEndsAt: announce ?? judge.deadline,
        summary: target ? `대상: ${target}` : undefined,
      });
    }
    return out;
  },
};
