import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from '../../calendar/calendar.service';
import { CalendarEvent } from '../../calendar/calendar.types';
import { escapeTags } from '../../common/text';
import { EnvVars } from '../../config/env';
import { MailAuthService } from '../../mail/mail-auth.service';
import { MailError } from '../../mail/mail.errors';
import { ContextTool, ToolError } from './tool';

const CAL_INTENT = /(일정|스케[줄쥴]|캘린더|달력|약속|미팅|회의|calendar|schedule|agenda|meeting)/i;
const DAY = 86_400_000;
const MAX_IN_CONTEXT = 30;
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export interface DayRange {
  label: string;
  /** 오늘 기준 시작 일 오프셋 */
  from: number;
  /** 일 수 */
  days: number;
  /** 특정 날짜 (M월 D일) */
  date?: { month: number; day: number };
}

/** 문장에서 조회 기간을 추출. 기본: 오늘부터 7일. */
export function parseRange(text: string, todayDow: number): DayRange {
  const md = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(text);
  if (md) return { label: `${md[1]}월 ${md[2]}일`, from: 0, days: 1, date: { month: +md[1], day: +md[2] } };
  if (/(내일\s*모레|모레)/.test(text)) return { label: '모레', from: 2, days: 1 };
  if (/글피/.test(text)) return { label: '글피', from: 3, days: 1 };
  if (/(내일|tomorrow)/i.test(text)) return { label: '내일', from: 1, days: 1 };
  if (/(오늘|today)/i.test(text)) return { label: '오늘', from: 0, days: 1 };
  const toMonday = (8 - todayDow) % 7 || 7; // 다음 월요일까지 일 수
  if (/(다음\s*주|담주|차주|next\s*week)/i.test(text)) return { label: '다음 주', from: toMonday, days: 7 };
  if (/(이번\s*주|금주|this\s*week)/i.test(text)) return { label: '이번 주', from: 0, days: toMonday };
  const n = /(\d{1,2})\s*일\s*(?:간|동안)|앞으로\s*(\d{1,2})\s*일/.exec(text);
  if (n) {
    const days = Math.min(Math.max(Number(n[1] ?? n[2]), 1), 31);
    return { label: `앞으로 ${days}일`, from: 0, days };
  }
  return { label: '앞으로 7일', from: 0, days: 7 };
}

/** tz 기준 날짜 성분 */
function localParts(d: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(d)
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
  return p;
}

/** tz 기준 y-m-d 00:00 의 UTC 시각 */
export function startOfLocalDay(y: number, m: number, d: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  const p = localParts(new Date(guess), tz);
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
  return new Date(guess - offset);
}

/** 채팅에서 일정 관련 질문이 오면 Outlook 일정을 읽어 프롬프트에 주입한다. 읽기 전용. */
@Injectable()
export class CalendarTool implements ContextTool {
  readonly name = 'outlook-calendar';
  readonly readOnly = true as const;

  constructor(
    private readonly calendar: CalendarService,
    private readonly auth: MailAuthService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  matches(text: string): boolean {
    return CAL_INTENT.test(text);
  }

  async run(text: string, signal?: AbortSignal, now: Date = new Date()): Promise<string> {
    if (!this.auth.configured) {
      throw new ToolError('Outlook 설정 없음 (MS_CLIENT_ID, TOKEN_ENC_KEY). 사용자에게 backend/README.md 설정을 안내한다.');
    }
    const tz = this.config.get('TIMEZONE', { infer: true });
    const t = localParts(now, tz);
    const dow = new Date(Date.UTC(t.year, t.month - 1, t.day)).getUTCDay();
    const r = parseRange(text, dow);

    let start: Date;
    if (r.date) {
      let year = t.year;
      if (Date.UTC(year, r.date.month - 1, r.date.day) < Date.UTC(t.year, t.month - 1, t.day) - 30 * DAY) year++;
      start = startOfLocalDay(year, r.date.month, r.date.day, tz);
    } else {
      start = startOfLocalDay(t.year, t.month, t.day + r.from, tz);
    }
    const end = new Date(start.getTime() + r.days * DAY);

    try {
      const list = await this.calendar.between(start, end, signal);
      return this.format(list, r, start, end, tz);
    } catch (e) {
      if (e instanceof MailError) {
        if (e.code === 'NOT_CONNECTED') {
          throw new ToolError('Outlook 미연결 또는 일정 권한(Calendars.Read) 없음. 사용자에게 Outlook 재로그인을 안내한다.', e);
        }
        throw new ToolError(`일정 조회 실패: ${e.message}`, e);
      }
      throw e;
    }
  }

  private format(list: CalendarEvent[], r: DayRange, start: Date, end: Date, tz: string): string {
    const day = (d: Date) => {
      const p = localParts(d, tz);
      const w = WEEKDAY[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
      return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}(${w})`;
    };
    const flat = (s: string) => escapeTags(s).replace(/\s*\n\s*/g, ' ');
    const last = new Date(end.getTime() - 1);
    const span = r.days === 1 ? day(start) : `${day(start)} ~ ${day(last)}`;
    const head = `Outlook 일정 ${r.label} (${span}) ${list.length}건. 시각은 ${tz} 기준.`;
    if (list.length === 0) return `${head}\n일정 없음.`;

    const rows = list.slice(0, MAX_IN_CONTEXT).map((e, i) => {
      const date = e.start.slice(0, 10);
      const time = e.isAllDay ? '종일' : `${e.start.slice(11, 16)}~${e.end.slice(11, 16)}`;
      const loc = e.location ? ` | 장소: ${flat(e.location)}` : '';
      return `${i + 1}. ${date} ${time} | ${flat(e.subject)}${loc}`;
    });
    if (list.length > MAX_IN_CONTEXT) rows.push(`… 외 ${list.length - MAX_IN_CONTEXT}건 생략`);
    return [head, ...rows].join('\n');
  }
}
