import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanText } from '../common/text';
import { EnvVars } from '../config/env';
import { MailAuthService } from '../mail/mail-auth.service';
import { MailError } from '../mail/mail.errors';
import { CalendarEvent } from './calendar.types';
import { EventDraft } from './event-parser';
import { localNow, startOfLocalDay } from './tz';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const HTTP_TIMEOUT_MS = 15_000;
const MAX_EVENTS = 100;

interface GraphEvent {
  id: string;
  subject?: string | null;
  start: { dateTime: string };
  end: { dateTime: string };
  isAllDay?: boolean;
  location?: { displayName?: string | null };
}

function toEvent(e: GraphEvent): CalendarEvent {
  return {
    id: e.id,
    subject: e.subject || '(제목 없음)',
    start: e.start.dateTime.slice(0, 19),
    end: e.end.dateTime.slice(0, 19),
    isAllDay: Boolean(e.isAllDay),
    location: cleanText(e.location?.displayName ?? ''),
  };
}

/** Microsoft Graph 일정. 조회 + 사용자 확인을 거친 생성·수정 (Calendars.ReadWrite). */
@Injectable()
export class CalendarService {
  constructor(
    private readonly auth: MailAuthService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  upcoming(days: number, signal?: AbortSignal, now: Date = new Date()): Promise<CalendarEvent[]> {
    return this.between(now, new Date(now.getTime() + days * 86_400_000), signal);
  }

  /** TIMEZONE 기준 오늘 하루 일정 */
  today(signal?: AbortSignal, now: Date = new Date()): Promise<CalendarEvent[]> {
    const tz = this.config.get('TIMEZONE', { infer: true });
    const t = localNow(now, tz);
    return this.between(startOfLocalDay(t.y, t.m, t.d, tz), startOfLocalDay(t.y, t.m, t.d + 1, tz), signal);
  }

  /** [start, end) 구간 일정 */
  async between(start: Date, end: Date, signal?: AbortSignal): Promise<CalendarEvent[]> {
    const qs = new URLSearchParams({
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      $select: 'id,subject,start,end,isAllDay,location',
      $orderby: 'start/dateTime',
      $top: String(MAX_EVENTS),
    }).toString();
    const data = await this.graph<{ value: GraphEvent[] }>(`/me/calendarView?${qs}`, signal);
    return data.value.map(toEvent);
  }

  /** 일정 생성. ActionService의 확인 후에만 호출한다. */
  async create(draft: EventDraft, signal?: AbortSignal): Promise<CalendarEvent> {
    const e = await this.graph<GraphEvent>('/me/events', signal, false, { method: 'POST', body: this.body(draft) });
    return toEvent(e);
  }

  /** 일정 수정 (시간·제목·장소). ActionService의 확인 후에만 호출한다. */
  async update(id: string, draft: EventDraft, signal?: AbortSignal): Promise<CalendarEvent> {
    const e = await this.graph<GraphEvent>(`/me/events/${encodeURIComponent(id)}`, signal, false, {
      method: 'PATCH',
      body: this.body(draft),
    });
    return toEvent(e);
  }

  private body(d: EventDraft): Record<string, unknown> {
    const timeZone = this.config.get('TIMEZONE', { infer: true });
    return {
      subject: d.subject,
      start: { dateTime: d.start, timeZone },
      end: { dateTime: d.end, timeZone },
      isAllDay: d.isAllDay,
      ...(d.location ? { location: { displayName: d.location } } : {}),
    };
  }

  private async graph<T>(
    path: string,
    signal?: AbortSignal,
    retried = false,
    write?: { method: 'POST' | 'PATCH'; body: unknown },
  ): Promise<T> {
    const token = await this.auth.getAccessToken();
    const tz = this.config.get('TIMEZONE', { infer: true });
    const timeout = AbortSignal.timeout(HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(GRAPH + path, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          Prefer: `outlook.timezone="${tz}"`,
          ...(write ? { 'Content-Type': 'application/json' } : {}),
        },
        method: write?.method ?? 'GET',
        body: write ? JSON.stringify(write.body) : undefined,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'TimeoutError') throw new MailError('TIMEOUT', 'graph request timed out', e);
      throw new MailError('UPSTREAM', 'graph unreachable', e);
    }
    if (res.status === 401 || res.status === 403) {
      if (retried || res.status === 403) {
        throw new MailError('NOT_CONNECTED', 'calendar unauthorized; reconnect outlook (Calendars.ReadWrite needed)');
      }
      this.auth.invalidateAccessToken();
      return this.graph<T>(path, signal, true, write);
    }
    if (res.status === 404) throw new MailError('NOT_FOUND', 'event not found');
    if (!res.ok) throw new MailError('UPSTREAM', `graph responded ${res.status}`);
    return (await res.json()) as T;
  }
}
