import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsSite, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_CATEGORIES } from './defaults';
import { FeedItem, mergePosts } from './merge';
import { PARSER_IDS, PARSERS, runParser, ScrapedItem } from './parsers';

const UA = 'AURA-personal-reader/1.0 (+local personal assistant; 1 req/site/hour)';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;
/** 사이트 사이 간격 */
const GAP_MS = 3_000;
/** 수동 새로고침 최소 간격 (사이트 부하 방지) */
const MANUAL_MIN_MS = 5 * 60_000;
const BOOT_DELAY_MS = 30_000;
const KEEP_DAYS = 180;
const DAY = 86_400_000;
export const MAX_SITES = 40;
export const MAX_CATEGORIES = 20;
/** 피드 계산에 쓰는 최근 글 수 */
const FEED_WINDOW = 400;

export interface SiteInput {
  name?: string;
  url?: string;
  parser?: string;
  itemSelector?: string | null;
  categoryId?: string | null;
  enabled?: boolean;
}

export interface FeedQuery {
  categoryId?: string;
  unread?: boolean;
  q?: string;
  limit?: number;
}

/** "naver.com/x" → "https://naver.com/x". http(s)만 */
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
  } catch {
    throw new BadRequestException({ code: 'BAD_URL', message: `잘못된 URL: ${raw}` });
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new BadRequestException({ code: 'BAD_URL', message: 'http/https 주소만 가능' });
  }
  return u.toString();
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/** 사용자가 정한 게시판 목록을 주기적으로 읽어 새 글을 DB에 저장. 목록 1페이지만, 사이트당 1요청. */
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

  private get tz(): string {
    return this.config.get('TIMEZONE', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.seed().catch((e: unknown) => this.log.warn(`기본 사이트 생성 실패: ${errText(e)}`));
    const every = this.intervalMs;
    if (every <= 0) return;
    this.boot = setTimeout(() => void this.runDue(), BOOT_DELAY_MS);
    this.timer = setInterval(() => void this.runDue(), every);
    this.boot.unref();
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearTimeout(this.boot);
    clearInterval(this.timer);
  }

  /** 카테고리·사이트가 하나도 없을 때만 기본값 생성 */
  async seed(): Promise<void> {
    const [c, s] = await Promise.all([this.prisma.newsCategory.count(), this.prisma.newsSite.count()]);
    if (c > 0 || s > 0) return;
    for (const [ci, cat] of DEFAULT_CATEGORIES.entries()) {
      await this.prisma.newsCategory.create({
        data: {
          name: cat.name,
          position: ci,
          sites: { create: cat.sites.map((site, si) => ({ ...site, position: si })) },
        },
      });
    }
    this.log.log('기본 카테고리·사이트 생성');
  }

  // ───────── 실행 ─────────

  /** 주기 실행: 켜져 있고 마지막 실행이 주기의 90% 이상 지난 사이트만 */
  runDue(): Promise<void> {
    return this.exclusive(async () => {
      const sites = await this.prisma.newsSite.findMany({ where: { enabled: true }, orderBy: { position: 'asc' } });
      const due = sites.filter((s) => !s.lastRunAt || Date.now() - s.lastRunAt.getTime() >= this.intervalMs * 0.9);
      await this.runSites(due);
    });
  }

  /** 수동 새로고침. 최근 5분 안에 돈 사이트는 건너뜀 */
  async refresh(siteId?: string) {
    if (siteId) await this.site(siteId);
    await this.exclusive(async () => {
      const sites = await this.prisma.newsSite.findMany({
        where: siteId ? { id: siteId } : { enabled: true },
        orderBy: { position: 'asc' },
      });
      await this.runSites(sites.filter((s) => !s.lastRunAt || Date.now() - s.lastRunAt.getTime() >= MANUAL_MIN_MS));
    });
    return this.categories();
  }

  /** 동시 실행 방지: 실행 중이면 그 실행을 기다림 */
  private async exclusive(fn: () => Promise<void>): Promise<void> {
    if (this.running) return this.running;
    this.running = fn()
      .catch((e: unknown) => this.log.error(`scrape: ${errText(e)}`))
      .finally(() => (this.running = null));
    return this.running;
  }

  private async runSites(list: NewsSite[]): Promise<void> {
    for (const [i, s] of list.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, GAP_MS));
      await this.runOne(s);
    }
    if (list.length > 0) await this.prune();
  }

  /** 목록 가져와 파싱 */
  async fetchItems(url: string, parser: string, itemSelector?: string | null, now = new Date()) {
    const html = await this.fetchText(url);
    const r = runParser(parser, html, { baseUrl: url, now, tz: this.tz, itemSelector: itemSelector || undefined });
    if (r.items.length === 0) throw new Error(`글 0개 (${r.parser.label}). 글 링크 CSS 선택자를 지정해 보세요`);
    return r;
  }

  /** 사이트 1개 실행. 실패해도 다른 사이트는 계속 */
  async runOne(s: NewsSite, now: Date = new Date()): Promise<number> {
    try {
      const { items } = await this.fetchItems(s.url, s.parser, s.itemSelector, now);
      // 첫 수집: 기존 글은 읽음 처리 (알림 폭탄 방지)
      const seenAt = s.lastOkAt ? null : now;
      const r = await this.prisma.scrapedPost.createMany({
        data: items.map((it) => ({ ...it, source: s.id, seenAt })),
        skipDuplicates: true,
      });
      const fresh = seenAt ? 0 : r.count;
      await this.prisma.newsSite.update({
        where: { id: s.id },
        data: { lastRunAt: now, lastOkAt: now, lastError: null, lastNew: fresh },
      });
      if (fresh > 0) this.log.log(`${s.name}: 새 글 ${fresh}개`);
      return fresh;
    } catch (e) {
      this.log.warn(`${s.name}: ${errText(e)}`);
      await this.prisma.newsSite
        .update({ where: { id: s.id }, data: { lastRunAt: now, lastError: errText(e), lastNew: 0 } })
        .catch(() => undefined); // 실행 중 삭제됨
      return 0;
    }
  }

  /** 저장 안 하고 미리보기 (사이트 추가 전 확인용) */
  async preview(input: { url: string; parser?: string; itemSelector?: string | null }) {
    const url = normalizeUrl(input.url);
    try {
      const r = await this.fetchItems(url, this.parserId(input.parser), input.itemSelector);
      return { parser: r.parser.id, parserLabel: r.parser.label, count: r.items.length, items: r.items.slice(0, 10) };
    } catch (e) {
      throw new BadRequestException({ code: 'SCRAPE_FAILED', message: errText(e) });
    }
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('응답 너무 큼');
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('응답 너무 큼');
    const head = new TextDecoder('latin1').decode(buf.slice(0, 2048));
    const charset =
      /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ??
      /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
      /encoding=["']([\w-]+)/i.exec(head)?.[1] ??
      'utf-8';
    try {
      return new TextDecoder(charset).decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf);
    }
  }

  /** 오래된 읽은 글 정리 */
  private prune() {
    return this.prisma.scrapedPost.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * DAY) }, seenAt: { not: null } },
    });
  }

  // ───────── 카테고리·사이트 관리 ─────────

  parsers() {
    return [{ id: 'auto', label: '자동 감지' }, ...PARSERS.map((p) => ({ id: p.id, label: p.label }))];
  }

  private parserId(p?: string): string {
    if (!p) return 'auto';
    if (!(PARSER_IDS as readonly string[]).includes(p)) {
      throw new BadRequestException({ code: 'BAD_PARSER', message: `알 수 없는 파서: ${p}` });
    }
    return p;
  }

  private async site(id: string) {
    const s = await this.prisma.newsSite.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: '사이트 없음' });
    return s;
  }

  private async checkCategory(id: string | null | undefined) {
    if (!id) return;
    const c = await this.prisma.newsCategory.findUnique({ where: { id } });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: '카테고리 없음' });
  }

  /** 카테고리 + 소속 사이트 + 안 읽은 수. 미분류 사이트는 id=null 묶음 */
  async categories() {
    const [cats, sites, unread] = await Promise.all([
      this.prisma.newsCategory.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.newsSite.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.scrapedPost.groupBy({ by: ['source'], where: { seenAt: null }, _count: { _all: true } }),
    ]);
    const counts = new Map(unread.map((u) => [u.source, u._count._all]));
    const view = (s: NewsSite) => ({ ...s, unread: counts.get(s.id) ?? 0 });
    const out = cats.map((c) => ({ id: c.id as string | null, name: c.name, sites: sites.filter((s) => s.categoryId === c.id).map(view) }));
    const loose = sites.filter((s) => !s.categoryId);
    if (loose.length) out.push({ id: null, name: '미분류', sites: loose.map(view) });
    return out;
  }

  async createCategory(name: string) {
    if ((await this.prisma.newsCategory.count()) >= MAX_CATEGORIES) {
      throw new BadRequestException({ code: 'TOO_MANY', message: `카테고리는 최대 ${MAX_CATEGORIES}개` });
    }
    const last = await this.prisma.newsCategory.aggregate({ _max: { position: true } });
    await this.prisma.newsCategory.create({ data: { name: name.trim(), position: (last._max.position ?? -1) + 1 } });
    return this.categories();
  }

  async updateCategory(id: string, input: { name?: string; position?: number }) {
    await this.checkCategory(id);
    await this.prisma.newsCategory.update({
      where: { id },
      data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.position !== undefined ? { position: input.position } : {}) },
    });
    return this.categories();
  }

  /** 카테고리 삭제. 소속 사이트는 미분류로 */
  async deleteCategory(id: string) {
    await this.checkCategory(id);
    await this.prisma.newsCategory.delete({ where: { id } });
    return this.categories();
  }

  async createSite(input: SiteInput & { name: string; url: string }) {
    if ((await this.prisma.newsSite.count()) >= MAX_SITES) {
      throw new BadRequestException({ code: 'TOO_MANY', message: `사이트는 최대 ${MAX_SITES}개` });
    }
    await this.checkCategory(input.categoryId);
    const last = await this.prisma.newsSite.aggregate({ _max: { position: true } });
    const site = await this.prisma.newsSite.create({
      data: {
        id: randomUUID(),
        name: input.name.trim() || new URL(normalizeUrl(input.url)).hostname,
        url: normalizeUrl(input.url),
        parser: this.parserId(input.parser),
        itemSelector: input.itemSelector?.trim() || null,
        categoryId: input.categoryId ?? null,
        enabled: input.enabled ?? true,
        position: (last._max.position ?? -1) + 1,
      },
    });
    void this.exclusive(() => this.runOne(site).then(() => undefined)); // 바로 첫 수집
    return this.categories();
  }

  async updateSite(id: string, input: SiteInput) {
    const cur = await this.site(id);
    await this.checkCategory(input.categoryId);
    const data: Prisma.NewsSiteUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim() || cur.name;
    if (input.url !== undefined) data.url = normalizeUrl(input.url);
    if (input.parser !== undefined) data.parser = this.parserId(input.parser);
    if (input.itemSelector !== undefined) data.itemSelector = input.itemSelector?.trim() || null;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    // 주소·파서가 바뀌면 다음 실행을 바로 + 첫 수집처럼 처리
    if (data.url !== undefined || data.parser !== undefined || data.itemSelector !== undefined) {
      Object.assign(data, { lastRunAt: null, lastOkAt: null, lastError: null });
    }
    await this.prisma.newsSite.update({ where: { id }, data });
    return this.categories();
  }

  /** 사이트 + 그 사이트 글 삭제 */
  async deleteSite(id: string) {
    await this.site(id);
    await this.prisma.$transaction([
      this.prisma.scrapedPost.deleteMany({ where: { source: id } }),
      this.prisma.newsSite.delete({ where: { id } }),
    ]);
    return this.categories();
  }

  // ───────── 피드 ─────────

  /** 카테고리별로 중복 합친 글 목록. categoryId 없으면 전체 (카테고리 단위로 합친 뒤 합산) */
  async feed(q: FeedQuery = {}): Promise<(FeedItem & { categoryId: string | null })[]> {
    const sites = await this.prisma.newsSite.findMany();
    if (q.categoryId) await this.checkCategory(q.categoryId);
    const scoped = q.categoryId ? sites.filter((s) => s.categoryId === q.categoryId) : sites;
    const term = q.q?.trim();
    const posts = await this.prisma.scrapedPost.findMany({
      where: {
        source: { in: scoped.map((s) => s.id) },
        ...(term
          ? { OR: [{ title: { contains: term, mode: 'insensitive' } }, { category: { contains: term, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { postedAt: { sort: 'desc', nulls: 'last' } }, { externalId: 'desc' }],
      take: FEED_WINDOW,
    });
    const byId = new Map(sites.map((s) => [s.id, s]));
    const buckets = new Map<string | null, typeof posts>();
    for (const p of posts) {
      const c = byId.get(p.source)?.categoryId ?? null;
      buckets.set(c, [...(buckets.get(c) ?? []), p]);
    }
    const name = (id: string) => byId.get(id)?.name ?? id;
    const items = [...buckets.entries()].flatMap(([categoryId, ps]) =>
      mergePosts(ps, name).map((i) => ({ ...i, categoryId })),
    );
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0));
    return items.filter((i) => !q.unread || i.unread).slice(0, Math.min(Math.max(q.limit ?? 100, 1), 300));
  }

  /** 카테고리별 안 읽은 글 수 (중복 합친 기준) + 가장 최근 새 글 시각 (알림용) */
  async unread() {
    const [cats, items, latest] = await Promise.all([
      this.prisma.newsCategory.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.feed({ unread: true, limit: 300 }),
      this.prisma.scrapedPost.aggregate({ where: { seenAt: null }, _max: { createdAt: true } }),
    ]);
    const count = (id: string | null) => items.filter((i) => i.categoryId === id).length;
    const byCategory = cats.map((c) => ({ id: c.id as string | null, name: c.name, count: count(c.id) }));
    if (count(null)) byCategory.push({ id: null, name: '미분류', count: count(null) });
    return { total: items.length, byCategory, latest: latest._max.createdAt };
  }

  /** 읽음 처리. ids 없으면 categoryId 범위 (없으면 전체) */
  async markSeen(ids?: string[], categoryId?: string): Promise<{ count: number }> {
    let source: Prisma.StringFilter | undefined;
    if (categoryId) {
      const sites = await this.prisma.newsSite.findMany({ where: { categoryId }, select: { id: true } });
      source = { in: sites.map((s) => s.id) };
    }
    const r = await this.prisma.scrapedPost.updateMany({
      where: { seenAt: null, ...(ids ? { id: { in: ids } } : {}), ...(source ? { source } : {}) },
      data: { seenAt: new Date() },
    });
    return { count: r.count };
  }

  /** 채팅 도구용: 이름으로 카테고리 찾기 */
  async categoryList() {
    return this.prisma.newsCategory.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { sites: { select: { id: true, name: true, lastOkAt: true, lastError: true, enabled: true } } },
    });
  }
}

export type { ScrapedItem };
