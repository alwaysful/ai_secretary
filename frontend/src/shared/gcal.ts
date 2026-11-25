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
