import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanText } from '../common/text';
import { EnvVars } from '../config/env';
import { MailAuthService } from '../mail/mail-auth.service';
import { MailError } from '../mail/mail.errors';
import { CalendarEvent } from './calendar.types';

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

/** Microsoft Graph 일정 조회 (GET만, Calendars.Read). */
@Injectable()
export class CalendarService {
  constructor(
    private readonly auth: MailAuthService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async upcoming(days: number, signal?: AbortSignal, now: Date = new Date()): Promise<CalendarEvent[]> {
    const end = new Date(now.getTime() + days * 86_400_000);
    const qs = new URLSearchParams({
      startDateTime: now.toISOString(),
      endDateTime: end.toISOString(),
      $select: 'id,subject,start,end,isAllDay,location',
      $orderby: 'start/dateTime',
      $top: String(MAX_EVENTS),
    }).toString();
    const data = await this.graph<{ value: GraphEvent[] }>(`/me/calendarView?${qs}`, signal);
    return data.value.map((e) => ({
      id: e.id,
      subject: e.subject || '(제목 없음)',
      start: e.start.dateTime.slice(0, 19),
      end: e.end.dateTime.slice(0, 19),
      isAllDay: Boolean(e.isAllDay),
      location: cleanText(e.location?.displayName ?? ''),
    }));
  }

  private async graph<T>(path: string, signal?: AbortSignal, retried = false): Promise<T> {
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
        },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'TimeoutError') throw new MailError('TIMEOUT', 'graph request timed out', e);
      throw new MailError('UPSTREAM', 'graph unreachable', e);
    }
    if (res.status === 401 || res.status === 403) {
      if (retried || res.status === 403) {
        throw new MailError('NOT_CONNECTED', 'calendar unauthorized; reconnect outlook (Calendars.Read needed)');
      }
      this.auth.invalidateAccessToken();
      return this.graph<T>(path, signal, true);
    }
    if (!res.ok) throw new MailError('UPSTREAM', `graph responded ${res.status}`);
    return (await res.json()) as T;
  }
}
