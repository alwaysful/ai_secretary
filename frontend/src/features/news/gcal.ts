import type { NewsItem } from '../../shared/api';

const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const nextDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

/**
 * 구글 캘린더 "일정 추가" 링크 (종일 일정). 로그인된 브라우저에서 저장 화면이 열림.
 * end 는 포함 날짜 → 구글 형식은 다음 날(배타)
 */
export function gcalUrl(title: string, start: Date, end: Date, details: string): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${ymd(start)}/${ymd(nextDay(end < start ? start : end))}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export interface GcalLink {
  label: string;
  url: string;
}

/** 글 → 신청기간·진행기간 일정 링크. 시작일 없으면 마감일 하루 */
export function gcalLinks(it: NewsItem): GcalLink[] {
  const body = [it.summary, ...it.links.map((l) => `${l.siteName}: ${l.url}`)].filter(Boolean).join('\n');
  const out: GcalLink[] = [];
  if (it.deadline) {
    const end = new Date(it.deadline);
    const start = it.startsAt ? new Date(it.startsAt) : end;
    out.push({ label: '신청', url: gcalUrl(`${it.startsAt ? '[신청]' : '[신청 마감]'} ${it.title}`, start, end, body) });
  }
  if (it.eventStartsAt || it.eventEndsAt) {
    const s = new Date(it.eventStartsAt ?? it.eventEndsAt!);
    const e = new Date(it.eventEndsAt ?? it.eventStartsAt!);
    out.push({ label: '진행', url: gcalUrl(`[진행] ${it.title}`, s, e, body) });
  }
  if (out.length === 0) {
    const d = new Date(it.postedAt ?? it.createdAt);
    out.push({ label: '추가', url: gcalUrl(it.title, d, d, body) });
  }
  return out;
}
