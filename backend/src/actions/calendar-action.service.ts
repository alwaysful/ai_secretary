import { randomUUID } from 'node:crypto';
import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from '../calendar/calendar.service';
import { CalendarEvent } from '../calendar/calendar.types';
import { EventDraft, isWriteIntent, parseEventCommand, UpdateChange } from '../calendar/event-parser';
import { addDays, localIso, localNow, parseLocalIso, shortLabel, startOfLocalDay } from '../calendar/tz';
import { escapeTags } from '../common/text';
import { EnvVars } from '../config/env';
import { MailAuthService } from '../mail/mail-auth.service';
import { MailError } from '../mail/mail.errors';

const TTL_MS = 30 * 60_000;
const DAY = 86_400_000;

/** 사용자 확인을 기다리는 일정 쓰기 작업 */
export interface PendingAction {
  id: string;
  kind: 'calendar.create' | 'calendar.update';
  conversationId: string | null;
  /** 화면 표시용 한 줄 요약 */
  summary: string;
  draft: EventDraft;
  /** 수정 대상 (update) */
  eventId?: string;
  before?: CalendarEvent;
  expiresAt: string;
}

export interface ActionPlan {
  /** 모델 프롬프트에 넣을 설명 */
  context: string;
  action?: PendingAction;
}

const describe = (d: EventDraft) => {
  const when = d.isAllDay
    ? `${shortLabel(d.start, false)} 종일`
    : `${shortLabel(d.start)}~${d.end.slice(11, 16)}`;
  return `${when} ${d.subject}${d.location ? ` @${d.location}` : ''}`;
};

/**
 * 채팅의 일정 생성·수정 요청을 "확인 대기 작업"으로 만든다.
 * 실제 쓰기는 사용자가 confirm(id)를 호출할 때만 한다. (모델은 쓰기를 실행할 수 없다)
 */
@Injectable()
export class CalendarActionService {
  private readonly pending = new Map<string, PendingAction>();

  constructor(
    private readonly calendar: CalendarService,
    private readonly auth: MailAuthService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async plan(
    text: string,
    conversationId: string | null,
    signal?: AbortSignal,
    now: Date = new Date(),
  ): Promise<ActionPlan | null> {
    if (!isWriteIntent(text)) return null;
    const wrap = (body: string) => `<calendar-action>\n${body}\n</calendar-action>`;
    if (!this.auth.configured) {
      return { context: wrap('Outlook 설정 없음. 일정 등록 불가. 사용자에게 backend/README.md 설정을 안내한다.') };
    }
    const tz = this.config.get('TIMEZONE', { infer: true });
    const cmd = parseEventCommand(text, localNow(now, tz));
    if (cmd.kind === 'unclear') {
      return { context: wrap(`일정 요청을 해석하지 못함: ${cmd.reason}. 사용자에게 다시 말해 달라고 안내한다.`) };
    }

    let action: PendingAction;
    if (cmd.kind === 'create') {
      action = this.store({ kind: 'calendar.create', conversationId, summary: `등록: ${describe(cmd.draft)}`, draft: cmd.draft }, now);
    } else {
      const start = startOfLocalDay(cmd.match.from.y, cmd.match.from.m, cmd.match.from.d, tz);
      let events: CalendarEvent[];
      try {
        events = await this.calendar.between(start, new Date(start.getTime() + cmd.match.days * DAY), signal);
      } catch (e) {
        if (e instanceof MailError) return { context: wrap(`일정 조회 실패 (${e.code}). Outlook 재로그인이 필요할 수 있다고 안내한다.`) };
        throw e;
      }
      const hits = this.findTargets(events, cmd.match.subject, cmd.match.time);
      if (hits.length === 0) {
        return { context: wrap(`바꿀 일정을 찾지 못함 (검색어: "${escapeTags(cmd.match.subject) || '없음'}"). 일정 제목과 날짜를 다시 물어본다.`) };
      }
      const target = hits[0];
      const draft = this.applyChange(target, cmd.change);
      action = this.store(
        {
          kind: 'calendar.update',
          conversationId,
          summary: `변경: ${describe({ ...target, location: target.location })} → ${describe(draft)}`,
          draft,
          eventId: target.id,
          before: target,
        },
        now,
      );
      if (hits.length > 1) {
        const others = hits.slice(1, 4).map((e) => describe(e)).join(', ');
        return { action, context: wrap(this.pendingText(action) + `\n후보가 여러 개라 첫 번째를 골랐다. 다른 후보: ${escapeTags(others)}`) };
      }
    }
    return { action, context: wrap(this.pendingText(action)) };
  }

  list(conversationId?: string): PendingAction[] {
    this.prune();
    return [...this.pending.values()].filter((a) => !conversationId || a.conversationId === conversationId);
  }

  async confirm(id: string, signal?: AbortSignal): Promise<CalendarEvent> {
    const a = this.take(id);
    try {
      return a.kind === 'calendar.create'
        ? await this.calendar.create(a.draft, signal)
        : await this.calendar.update(a.eventId!, a.draft, signal);
    } catch (e) {
      // 실패하면 다시 시도할 수 있게 되돌려 놓는다
      this.pending.set(a.id, a);
      throw e;
    }
  }

  cancel(id: string): void {
    this.take(id);
  }

  private pendingText(a: PendingAction): string {
    return [
      `[확인 대기] ${escapeTags(a.summary)}`,
      '아직 Outlook에 저장되지 않았다. 사용자가 화면의 "확인" 버튼을 눌러야 저장된다.',
      '내용(날짜·시간·제목)을 한 줄로 보여주고 확인 버튼을 눌러 달라고 짧게 안내한다. 이미 등록했다고 말하지 않는다.',
    ].join('\n');
  }

  private findTargets(events: CalendarEvent[], subject: string, time?: number): CalendarEvent[] {
    const words = subject.split(/\s+/).filter(Boolean);
    return events.filter((e) => {
      if (words.length && !words.some((w) => e.subject.includes(w))) return false;
      if (time !== undefined && !e.isAllDay && parseLocalIso(e.start).minutes !== time) return false;
      return true;
    });
  }

  private applyChange(e: CalendarEvent, c: UpdateChange): EventDraft {
    const s = parseLocalIso(e.start);
    const en = parseLocalIso(e.end);
    const dayDiff = Math.round((Date.UTC(en.day.y, en.day.m - 1, en.day.d) - Date.UTC(s.day.y, s.day.m - 1, s.day.d)) / DAY);
    const duration = c.durationMin ?? dayDiff * 1440 + en.minutes - s.minutes;
    const day = c.day ?? s.day;
    let start = c.time ?? s.minutes;
    if (c.shiftMin) start += c.shiftMin;
    const base = start < 0 ? addDays(day, -1) : day;
    const startNorm = ((start % 1440) + 1440) % 1440;
    return {
      subject: e.subject,
      start: localIso(base, startNorm),
      end: localIso(base, startNorm + duration),
      isAllDay: e.isAllDay && c.time === undefined && !c.shiftMin,
      location: e.location,
    };
  }

  private store(a: Omit<PendingAction, 'id' | 'expiresAt'>, now: Date): PendingAction {
    this.prune(now);
    // 재생성 등으로 같은 요청이 반복되면 기존 작업 재사용
    const dup = [...this.pending.values()].find((x) => x.conversationId === a.conversationId && x.summary === a.summary);
    if (dup) return dup;
    const action: PendingAction = { ...a, id: randomUUID(), expiresAt: new Date(now.getTime() + TTL_MS).toISOString() };
    this.pending.set(action.id, action);
    return action;
  }

  private take(id: string): PendingAction {
    this.prune();
    const a = this.pending.get(id);
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: '확인 대기 작업이 없음 (만료 또는 처리됨)' });
    if (Date.parse(a.expiresAt) < Date.now()) {
      this.pending.delete(id);
      throw new GoneException('작업이 만료됨');
    }
    this.pending.delete(id);
    return a;
  }

  private prune(now = new Date()): void {
    for (const [id, a] of this.pending) if (Date.parse(a.expiresAt) < now.getTime()) this.pending.delete(id);
  }
}
