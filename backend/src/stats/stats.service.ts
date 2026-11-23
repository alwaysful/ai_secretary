import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from '../calendar/calendar.service';
import { localNow, startOfLocalDay } from '../calendar/tz';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { localDate } from '../study/study-stats.service';
import { costUsd, defaultPrice, Price } from './pricing';

const DAY_MS = 86_400_000;
const PROVIDERS = ['gemini', 'anthropic', 'openai'] as const;

function ymdAdd(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function dayList(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => ymdAdd(last, i - count + 1));
}

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvVars, true>,
    private readonly calendar: CalendarService,
  ) {}

  private get tz(): string {
    return this.config.get('TIMEZONE', { infer: true });
  }

  private startOf(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number);
    return startOfLocalDay(y, m, d, this.tz);
  }

  /** 공부·채팅·소식·기억·일정 종합 통계 (최근 days일) */
  async overview(days: number) {
    const tz = this.tz;
    const now = new Date();
    const today = localDate(now, tz);
    const list = dayList(today, days);
    const since = this.startOf(list[0]);
    const streakSince = this.startOf(ymdAdd(today, -89));

    const [sessions, phone, streakRows, messages, convNew, convAll, posts, unread, deadlines, memAll, memOn, shortcuts, sites] = await Promise.all([
      this.prisma.studySession.findMany({ where: { startedAt: { gte: since } } }),
      this.prisma.phoneEvent.findMany({ where: { at: { gte: since } }, select: { at: true, label: true, package: true } }),
      this.prisma.studySession.findMany({ where: { startedAt: { gte: streakSince }, focusSec: { gt: 0 } }, select: { startedAt: true } }),
      this.prisma.message.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, role: true, model: true, promptTokens: true, completionTokens: true, durationMs: true, stopped: true },
      }),
      this.prisma.conversation.count({ where: { createdAt: { gte: since } } }),
      this.prisma.conversation.count(),
      this.prisma.scrapedPost.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, source: true } }),
      this.prisma.scrapedPost.count({ where: { seenAt: null } }),
      this.prisma.scrapedPost.findMany({
        where: { deadline: { gte: now, lte: new Date(now.getTime() + 14 * DAY_MS) } },
        orderBy: { deadline: 'asc' },
        take: 6,
        select: { id: true, title: true, url: true, deadline: true },
      }),
      this.prisma.memory.count(),
      this.prisma.memory.count({ where: { enabled: true } }),
      this.prisma.webShortcut.count(),
      this.prisma.newsSite.findMany({ select: { id: true, name: true } }),
    ]);

    // 공부
    const focusByDay = new Map(list.map((d) => [d, 0]));
    const viol = { posture: 0, phone: 0, slack: 0, sleep: 0 };
    let focusSec = 0;
    let pomodoros = 0;
    let longest = 0;
    for (const s of sessions) {
      const d = localDate(s.startedAt, tz);
      if (focusByDay.has(d)) focusByDay.set(d, focusByDay.get(d)! + s.focusSec);
      focusSec += s.focusSec;
      pomodoros += s.pomodoros;
      longest = Math.max(longest, s.focusSec);
      viol.posture += s.posture;
      viol.phone += s.phone;
      viol.slack += s.slack;
      viol.sleep += s.sleep;
    }
    const apps = new Map<string, number>();
    for (const e of phone) apps.set(e.label || e.package, (apps.get(e.label || e.package) ?? 0) + 1);
    const studyDays = new Set(streakRows.map((r) => localDate(r.startedAt, tz)));
    let streak = 0;
    for (let d = studyDays.has(today) ? today : ymdAdd(today, -1); studyDays.has(d); d = ymdAdd(d, -1)) streak++;
    const studied = [...focusByDay.values()].filter((v) => v > 0).length;

    // 채팅
    const msgByDay = new Map(list.map((d) => [d, 0]));
    const models = new Map<string, number>();
    let userMsgs = 0;
    let aiMsgs = 0;
    let tokens = 0;
    let durSum = 0;
    let durN = 0;
    let stopped = 0;
    const hours = Array<number>(24).fill(0);
    for (const m of messages) {
      if (m.role === 'USER') {
        userMsgs++;
        const d = localDate(m.createdAt, tz);
        if (msgByDay.has(d)) msgByDay.set(d, msgByDay.get(d)! + 1);
        hours[localNow(m.createdAt, tz).hour]++;
      } else if (m.role === 'ASSISTANT') {
        aiMsgs++;
        if (m.model) models.set(m.model, (models.get(m.model) ?? 0) + 1);
        tokens += (m.promptTokens ?? 0) + (m.completionTokens ?? 0);
        if (m.durationMs) {
          durSum += m.durationMs;
          durN++;
        }
        if (m.stopped) stopped++;
      }
    }

    // 새 소식
    const siteName = new Map(sites.map((s) => [s.id, s.name]));
    const postByDay = new Map(list.map((d) => [d, 0]));
    const bySite = new Map<string, number>();
    for (const p of posts) {
      const d = localDate(p.createdAt, tz);
      if (postByDay.has(d)) postByDay.set(d, postByDay.get(d)! + 1);
      const n = siteName.get(p.source) ?? p.source;
      bySite.set(n, (bySite.get(n) ?? 0) + 1);
    }

    // 일정 (메일 계정 연동 필요)
    let calendar: { connected: boolean; today: number; week: number; error?: string };
    try {
      const start = this.startOf(today);
      const ev = await this.calendar.between(start, new Date(start.getTime() + 7 * DAY_MS), AbortSignal.timeout(8000));
      calendar = { connected: true, today: ev.filter((e) => e.start.startsWith(today)).length, week: ev.length };
    } catch (e) {
      calendar = { connected: false, today: 0, week: 0, error: e instanceof Error ? e.message.split('\n')[0] : String(e) };
    }

    const top = (m: Map<string, number>, n: number) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

    return {
      days,
      dates: list,
      study: {
        focusSec,
        pomodoros,
        sessions: sessions.length,
        longestSec: longest,
        studiedDays: studied,
        avgPerDaySec: Math.round(focusSec / days),
        streak,
        daily: list.map((d) => focusByDay.get(d)!),
        violations: viol,
        phoneApps: phone.length,
        topApps: top(apps, 6),
      },
      chat: {
        conversations: convNew,
        conversationsAll: convAll,
        userMessages: userMsgs,
        aiMessages: aiMsgs,
        stopped,
        tokens,
        avgReplyMs: durN ? Math.round(durSum / durN) : 0,
        daily: list.map((d) => msgByDay.get(d)!),
        hours,
        models: top(models, 6),
      },
      news: {
        newPosts: posts.length,
        unread,
        daily: list.map((d) => postByDay.get(d)!),
        bySite: top(bySite, 6),
        deadlines: deadlines.map((p) => ({ id: p.id, title: p.title, url: p.url, deadline: p.deadline!.toISOString() })),
      },
      memory: { total: memAll, enabled: memOn },
      shortcuts,
      calendar,
    };
  }

  private async prices(): Promise<Map<string, Price>> {
    const rows = await this.prisma.apiPrice.findMany();
    return new Map(rows.map((r) => [r.model, { input: r.input, output: r.output }]));
  }

  /** month: YYYY-MM (기본 이번 달, TIMEZONE 기준) */
  async apiUsage(month?: string) {
    const tz = this.tz;
    const now = localNow(new Date(), tz);
    const cur = `${now.y}-${String(now.m).padStart(2, '0')}`;
    const ym = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : cur;
    const [y, m] = ym.split('-').map(Number);
    const start = startOfLocalDay(y, m, 1, tz);
    const end = m === 12 ? startOfLocalDay(y + 1, 1, 1, tz) : startOfLocalDay(y, m + 1, 1, tz);
    const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    const prevStart = m === 1 ? startOfLocalDay(y - 1, 12, 1, tz) : startOfLocalDay(y, m - 1, 1, tz);

    const [rows, prevRows, custom] = await Promise.all([
      this.prisma.apiUsage.findMany({ where: { at: { gte: start, lt: end } }, select: { at: true, provider: true, model: true, feature: true, inputTokens: true, outputTokens: true, audioSec: true } }),
      this.prisma.apiUsage.findMany({ where: { at: { gte: prevStart, lt: start } }, select: { model: true, inputTokens: true, outputTokens: true, audioSec: true } }),
      this.prices(),
    ]);
    const priceOf = (model: string) => custom.get(model) ?? defaultPrice(model);

    type Agg = { calls: number; inputTokens: number; outputTokens: number; audioSec: number; cost: number };
    const blank = (): Agg => ({ calls: 0, inputTokens: 0, outputTokens: 0, audioSec: 0, cost: 0 });
    const add = (a: Agg, r: { inputTokens: number; outputTokens: number; audioSec: number }, cost: number) => {
      a.calls++;
      a.inputTokens += r.inputTokens;
      a.outputTokens += r.outputTokens;
      a.audioSec += r.audioSec;
      a.cost += cost;
    };

    const total = blank();
    const byProvider = new Map<string, Agg>(PROVIDERS.map((p) => [p, blank()]));
    const byModel = new Map<string, Agg & { provider: string; model: string }>();
    const byFeature = new Map<string, Agg>();
    const daily = Array.from({ length: daysIn }, () => Object.fromEntries(PROVIDERS.map((p) => [p, 0])) as Record<string, number>);
    for (const r of rows) {
      const cost = costUsd(priceOf(r.model), r.inputTokens, r.outputTokens, r.audioSec);
      add(total, r, cost);
      if (!byProvider.has(r.provider)) byProvider.set(r.provider, blank());
      add(byProvider.get(r.provider)!, r, cost);
      const key = `${r.provider}\u0000${r.model}`;
      if (!byModel.has(key)) byModel.set(key, { provider: r.provider, model: r.model, ...blank() });
      add(byModel.get(key)!, r, cost);
      if (!byFeature.has(r.feature)) byFeature.set(r.feature, blank());
      add(byFeature.get(r.feature)!, r, cost);
      const day = Number(localDate(r.at, tz).slice(8, 10)) - 1;
      if (daily[day]) daily[day][r.provider] = (daily[day][r.provider] ?? 0) + cost;
    }
    const prevCost = prevRows.reduce((s, r) => s + costUsd(priceOf(r.model), r.inputTokens, r.outputTokens, r.audioSec), 0);
    // 이번 달이면 지금 속도로 월말 예상
    const elapsed = ym === cur ? now.d : daysIn;
    const fix = (a: Agg) => ({ ...a, cost: round(a.cost) });

    return {
      month: ym,
      prevMonth: prev,
      total: fix(total),
      prevCost: round(prevCost),
      projected: round((total.cost / Math.max(1, elapsed)) * daysIn),
      providers: [...byProvider.entries()].map(([provider, a]) => ({ provider, ...fix(a) })),
      models: [...byModel.values()]
        .sort((a, b) => b.cost - a.cost)
        .map((a) => ({ ...fix(a), price: priceOf(a.model), custom: custom.has(a.model) })),
      features: [...byFeature.entries()].map(([feature, a]) => ({ feature, ...fix(a) })),
      daily: daily.map((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, round(v)]))),
    };
  }

  setPrice(model: string, p: Price) {
    return this.prisma.apiPrice.upsert({ where: { model }, create: { model, ...p }, update: p });
  }

  async resetPrice(model: string): Promise<void> {
    await this.prisma.apiPrice.deleteMany({ where: { model } });
  }
}
