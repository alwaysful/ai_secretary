import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarEvent } from '../calendar/calendar.types';
import { EventDraft } from '../calendar/event-parser';
import { cleanText } from '../common/text';
import { EnvVars } from '../config/env';
import { GoogleApi } from './google-api.service';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const MAX_EVENTS = 100;

interface GTime {
  dateTime?: string;
  date?: string;
}
export interface GoogleEvent {
  id: string;
  summary?: string | null;
  location?: string | null;
  status?: string;
  start: GTime;
  end: GTime;
}

/** timeZone 파라미터로 받은 dateTime(오프셋 포함)은 앞 19자가 로컬 시각 */
const local = (t: GTime) => (t.dateTime ? t.dateTime.slice(0, 19) : `${t.date}T00:00:00`);

export function toEvent(e: GoogleEvent): CalendarEvent {
  return {
    id: e.id,
    subject: e.summary || '(제목 없음)',
    start: local(e.start),
    end: local(e.end),
    isAllDay: !e.start.dateTime,
    location: cleanText(e.location ?? ''),
    source: 'google',
  };
}

/** Google 캘린더 (기본 캘린더). 조회 + 사용자 확인을 거친 생성·수정. */
@Injectable()
export class GoogleCalendarService {
  constructor(
    private readonly api: GoogleApi,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async between(start: Date, end: Date, signal?: AbortSignal): Promise<CalendarEvent[]> {
    const qs = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(MAX_EVENTS),
      timeZone: this.tz(),
    });
    const data = await this.api.call<{ items?: GoogleEvent[] }>(`${BASE}?${qs.toString()}`, signal);
    return (data.items ?? []).filter((e) => e.status !== 'cancelled').map(toEvent);
  }

  async create(draft: EventDraft, signal?: AbortSignal): Promise<CalendarEvent> {
    return toEvent(await this.api.call<GoogleEvent>(BASE, signal, { method: 'POST', body: this.body(draft, false) }));
  }

  async update(id: string, draft: EventDraft, signal?: AbortSignal): Promise<CalendarEvent> {
    const url = `${BASE}/${encodeURIComponent(id)}`;
    return toEvent(await this.api.call<GoogleEvent>(url, signal, { method: 'PATCH', body: this.body(draft, true) }));
  }

  private tz(): string {
    return this.config.get('TIMEZONE', { infer: true });
  }

  /** patch: 종일↔시간 전환 시 반대 필드를 null로 지운다 */
  body(d: EventDraft, patch: boolean): Record<string, unknown> {
    const timeZone = this.tz();
    const time = (s: string) =>
      d.isAllDay
        ? { date: s.slice(0, 10), ...(patch ? { dateTime: null, timeZone: null } : {}) }
        : { dateTime: s, timeZone, ...(patch ? { date: null } : {}) };
    return {
      summary: d.subject,
      start: time(d.start),
      end: time(d.end),
      ...(d.location ? { location: d.location } : {}),
    };
  }
}
