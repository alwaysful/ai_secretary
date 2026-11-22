import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from '../config/env';
import { GoogleAuthService } from '../google/google-auth.service';
import { GoogleCalendarService } from '../google/google-calendar.service';
import { MailAuthService } from '../mail/mail-auth.service';
import { MailError } from '../mail/mail.errors';
import { CalendarService } from './calendar.service';
import { CalendarEvent, CalendarSource } from './calendar.types';
import { EventDraft } from './event-parser';
import { localNow, startOfLocalDay } from './tz';

/**
 * Outlook + Google 캘린더 통합.
 * 조회: 연결된 곳 모두 합쳐 시간순. 한쪽만 실패하면 나머지만 돌려준다.
 * 생성: Google 연결 시 Google, 아니면 Outlook. 수정: 일정의 source로.
 */
@Injectable()
export class CalendarHub {
  private readonly log = new Logger(CalendarHub.name);

  constructor(
    private readonly outlook: CalendarService,
    private readonly outlookAuth: MailAuthService,
    private readonly google: GoogleCalendarService,
    private readonly googleAuth: GoogleAuthService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  /** 하나라도 설정됨 */
  get configured(): boolean {
    return this.outlookAuth.configured || this.googleAuth.configured;
  }

  async sources(): Promise<CalendarSource[]> {
    const [o, g] = await Promise.all([
      this.outlookAuth.configured ? this.outlookAuth.status().then((s) => s.connected) : false,
      this.googleAuth.isConnected(),
    ]);
    return [...(o ? (['outlook'] as const) : []), ...(g ? (['google'] as const) : [])];
  }

  async between(start: Date, end: Date, signal?: AbortSignal): Promise<CalendarEvent[]> {
    const src = await this.sources();
    if (src.length === 0) {
      throw new MailError(this.configured ? 'NOT_CONNECTED' : 'NOT_CONFIGURED', 'no calendar connected');
    }
    const results = await Promise.allSettled(
      src.map(async (s): Promise<CalendarEvent[]> => {
        const list = await (s === 'google' ? this.google : this.outlook).between(start, end, signal);
        return list.map((e) => ({ ...e, source: s }));
      }),
    );
    const ok = results.filter((r): r is PromiseFulfilledResult<CalendarEvent[]> => r.status === 'fulfilled');
    if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason;
    for (const r of results) {
      if (r.status === 'rejected') this.log.warn(`calendar source failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
    return ok.flatMap((r) => r.value).sort((a, b) => a.start.localeCompare(b.start));
  }

  upcoming(days: number, signal?: AbortSignal, now: Date = new Date()): Promise<CalendarEvent[]> {
    return this.between(now, new Date(now.getTime() + days * 86_400_000), signal);
  }

  /** TIMEZONE 기준 오늘 하루 */
  today(signal?: AbortSignal, now: Date = new Date()): Promise<CalendarEvent[]> {
    const tz = this.config.get('TIMEZONE', { infer: true });
    const t = localNow(now, tz);
    return this.between(startOfLocalDay(t.y, t.m, t.d, tz), startOfLocalDay(t.y, t.m, t.d + 1, tz), signal);
  }

  /** 새 일정을 쓸 곳 */
  async writeTarget(): Promise<CalendarSource | null> {
    const src = await this.sources();
    return src.includes('google') ? 'google' : (src[0] ?? null);
  }

  async create(draft: EventDraft, signal?: AbortSignal, target?: CalendarSource): Promise<CalendarEvent> {
    const t = target ?? (await this.writeTarget());
    if (!t) throw new MailError('NOT_CONNECTED', 'no calendar connected');
    return { ...(await (t === 'google' ? this.google : this.outlook).create(draft, signal)), source: t };
  }

  async update(id: string, draft: EventDraft, signal?: AbortSignal, source: CalendarSource = 'outlook'): Promise<CalendarEvent> {
    return { ...(await (source === 'google' ? this.google : this.outlook).update(id, draft, signal)), source };
  }
}
