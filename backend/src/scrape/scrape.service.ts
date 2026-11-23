import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ScrapeKind, ScrapeSource, SOURCES } from './sources';

const UA = 'AURA-personal-reader/1.0 (+local personal assistant; 1 req/source/hour)';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;
/** 소스 사이 간격 */
const GAP_MS = 3_000;
/** 수동 새로고침 최소 간격 (사이트 부하 방지) */
const MANUAL_MIN_MS = 5 * 60_000;
const BOOT_DELAY_MS = 30_000;
const KEEP_DAYS = 180;
const DAY = 86_400_000;

export interface SourceStatus {
  id: string;
  name: string;
  kind: ScrapeKind;
  homeUrl: string;
  enabled: boolean;
  lastRunAt: Date | null;
  lastOkAt: Date | null;
  lastError: string | null;
  lastNew: number;
  unread: number;
}

export interface ListQuery {
  kind?: ScrapeKind;
  source?: string;
  unread?: boolean;
  q?: string;
  limit?: number;
}

/** 공개 목록 페이지를 주기적으로 읽어 새 글을 DB에 저장. 목록 1페이지만, 소스당 1요청. */
@Injectable()
export class ScrapeService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ScrapeService.name);
  private timer?: NodeJS.Timeout;
  private boot?: NodeJS.Timeout;
  private running: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  private get intervalMs(): number {
    return this.config.get('SCRAPE_INTERVAL_MIN', { infer: true }) * 60_000;
  }

  onModuleInit(): void {
    const every = this.intervalMs;
    if (every <= 0 || process.env.NODE_ENV === 'test') return;
    this.boot = setTimeout(() => void this.runDue(), BOOT_DELAY_MS);
    this.timer = setInterval(() => void this.runDue(), every);
    this.boot.unref();
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearTimeout(this.boot);
    clearInterval(this.timer);
  }

  sourceOf(id: string): ScrapeSource {
    const s = SOURCES.find((x) => x.id === id);
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: `unknown source: ${id}` });
    return s;
  }

  /** 주기 실행: 켜져 있고 마지막 실행이 주기의 90% 이상 지난 소스만 */
  runDue(): Promise<void> {
    return this.exclusive(async () => {
      const states = await this.states();
      const due = SOURCES.filter((s) => {
        const st = states.get(s.id);
        if (st && !st.enabled) return false;
        return !st?.lastRunAt || Date.now() - st.lastRunAt.getTime() >= this.intervalMs * 0.9;
      });
      await this.runSources(due);
    });
  }

  /** 수동 새로고침. 최근 5분 안에 돈 소스는 건너뜀 */
  refresh(sourceId?: string): Promise<SourceStatus[]> {
    const targets = sourceId ? [this.sourceOf(sourceId)] : SOURCES;
    return this.exclusive(async () => {
      const states = await this.states();
      const due = targets.filter((s) => {
        const st = states.get(s.id);
        if (!sourceId && st && !st.enabled) return false;
        return !st?.lastRunAt || Date.now() - st.lastRunAt.getTime() >= MANUAL_MIN_MS;
      });
      await this.runSources(due);
    }).then(() => this.status());
  }

  /** 동시 실행 방지: 실행 중이면 그 실행을 기다림 */
  private async exclusive(fn: () => Promise<void>): Promise<void> {
    if (this.running) return this.running;
    this.running = fn()
      .catch((e: unknown) => this.log.error(`scrape: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => (this.running = null));
    return this.running;
  }

  private async runSources(list: readonly ScrapeSource[]): Promise<void> {
    for (const [i, s] of list.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, GAP_MS));
      await this.runOne(s);
    }
    if (list.length > 0) await this.prune();
  }

  /** 한 소스 실행. 실패해도 다른 소스는 계속 */
  async runOne(s: ScrapeSource, now: Date = new Date()): Promise<number> {
    const prev = await this.prisma.scrapeSourceState.findUnique({ where: { id: s.id } });
    try {
      const html = await this.fetchText(s.listUrl);
      const items = s.parse(html, { baseUrl: s.listUrl, now, tz: this.config.get('TIMEZONE', { infer: true }) });
      if (items.length === 0) throw new Error('글 0개 (페이지 구조 변경?)');
      // 첫 실행: 기존 글은 읽음 처리 (알림 폭탄 방지)
      const seenAt = prev?.lastOkAt ? null : now;
      const r = await this.prisma.scrapedPost.createMany({
        data: items.map((it) => ({ ...it, source: s.id, seenAt })),
        skipDuplicates: true,
      });
      const fresh = seenAt ? 0 : r.count;
      await this.saveState(s.id, { lastRunAt: now, lastOkAt: now, lastError: null, lastNew: fresh });
      if (fresh > 0) this.log.log(`${s.id}: 새 글 ${fresh}개`);
      return fresh;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      this.log.warn(`${s.id}: ${msg}`);
      await this.saveState(s.id, { lastRunAt: now, lastError: msg, lastNew: 0 });
      return 0;
    }
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) throw new Error('응답 너무 큼');
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('응답 너무 큼');
    const charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ?? 'utf-8';
    try {
      return new TextDecoder(charset).decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf);
    }
  }

  private saveState(id: string, data: Omit<Prisma.ScrapeSourceStateUncheckedCreateInput, 'id'>) {
    return this.prisma.scrapeSourceState.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  private async states() {
    const rows = await this.prisma.scrapeSourceState.findMany();
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** 오래된 읽은 글 정리 */
  private prune() {
    return this.prisma.scrapedPost.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * DAY) }, seenAt: { not: null } },
    });
  }

  async status(): Promise<SourceStatus[]> {
    const [states, unread] = await Promise.all([
      this.states(),
      this.prisma.scrapedPost.groupBy({ by: ['source'], where: { seenAt: null }, _count: { _all: true } }),
    ]);
    const counts = new Map(unread.map((u) => [u.source, u._count._all]));
    return SOURCES.map((s) => {
      const st = states.get(s.id);
      return {
        id: s.id,
        name: s.name,
        kind: s.kind,
        homeUrl: s.homeUrl,
        enabled: st?.enabled ?? true,
        lastRunAt: st?.lastRunAt ?? null,
        lastOkAt: st?.lastOkAt ?? null,
        lastError: st?.lastError ?? null,
        lastNew: st?.lastNew ?? 0,
        unread: counts.get(s.id) ?? 0,
      };
    });
  }

  async setEnabled(id: string, enabled: boolean): Promise<SourceStatus[]> {
    this.sourceOf(id);
    await this.prisma.scrapeSourceState.upsert({ where: { id }, create: { id, enabled }, update: { enabled } });
    return this.status();
  }

  private idsOf(kind?: ScrapeKind, source?: string): string[] | undefined {
    if (source) return [this.sourceOf(source).id];
    return kind ? SOURCES.filter((s) => s.kind === kind).map((s) => s.id) : undefined;
  }

  list(q: ListQuery = {}) {
    const ids = this.idsOf(q.kind, q.source);
    const term = q.q?.trim();
    return this.prisma.scrapedPost.findMany({
      where: {
        ...(ids ? { source: { in: ids } } : {}),
        ...(q.unread ? { seenAt: null } : {}),
        ...(term
          ? { OR: [{ title: { contains: term, mode: 'insensitive' } }, { category: { contains: term, mode: 'insensitive' } }] }
          : {}),
      },
      // 새 글 먼저, 그다음 게시일·수집일 최신순
      orderBy: [{ createdAt: 'desc' }, { postedAt: { sort: 'desc', nulls: 'last' } }, { externalId: 'desc' }],
      take: Math.min(Math.max(q.limit ?? 50, 1), 200),
    });
  }

  /** 종류별 안 읽은 글 수 + 가장 최근 새 글 시각 (알림용) */
  async unread(): Promise<{ total: number; notice: number; contest: number; latest: Date | null }> {
    const rows = await this.prisma.scrapedPost.groupBy({
      by: ['source'],
      where: { seenAt: null },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const kindOf = new Map(SOURCES.map((s) => [s.id, s.kind]));
    const r = { total: 0, notice: 0, contest: 0, latest: null as Date | null };
    for (const row of rows) {
      const k = kindOf.get(row.source);
      if (!k) continue;
      r[k] += row._count._all;
      r.total += row._count._all;
      const m = row._max.createdAt;
      if (m && (!r.latest || m > r.latest)) r.latest = m;
    }
    return r;
  }

  async markSeen(ids?: string[], kind?: ScrapeKind): Promise<{ count: number }> {
    const src = this.idsOf(kind);
    const r = await this.prisma.scrapedPost.updateMany({
      where: { seenAt: null, ...(ids ? { id: { in: ids } } : {}), ...(src ? { source: { in: src } } : {}) },
      data: { seenAt: new Date() },
    });
    return { count: r.count };
  }
}
