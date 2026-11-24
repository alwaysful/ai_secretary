import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import os from 'node:os';
import { BaseModel } from '../ai/models/base-model';
import { PrismaService } from '../prisma/prisma.service';
import { ScrapeService } from '../scrape/scrape.service';
import { Permissions, SettingsService } from '../settings/settings.service';

export const RESET_KINDS = ['conversations', 'memories', 'news', 'study', 'phone', 'apiUsage', 'vocab'] as const;
export type ResetKind = (typeof RESET_KINDS)[number];

@Injectable()
export class AdminService {
  private readonly log = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly model: BaseModel,
    private readonly settings: SettingsService,
    private readonly scrape: ScrapeService,
  ) {}

  async overview() {
    const p = this.prisma;
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [db, probe, counts, sites, usage] = await Promise.all([
      p.$queryRaw`SELECT 1`.then(
        () => 'ok' as const,
        () => 'down' as const,
      ),
      this.model.probe().catch(() => null),
      Promise.all([
        p.conversation.count(),
        p.message.count(),
        p.memory.count(),
        p.scrapedPost.count(),
        p.studySession.count(),
        p.phoneEvent.count(),
        p.apiUsage.count(),
        p.vocabCard.count(),
      ]).catch(() => null),
      p.newsSite
        .findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true, enabled: true, lastRunAt: true, lastOkAt: true, lastError: true } })
        .catch(() => []),
      p.apiUsage
        .groupBy({ by: ['provider'], where: { at: { gte: since } }, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true } })
        .catch(() => []),
    ]);
    const mem = process.memoryUsage();
    const s = this.settings.get();
    return {
      server: {
        uptimeSec: Math.round(process.uptime()),
        node: process.version,
        platform: `${os.platform()} ${os.release()}`,
        pid: process.pid,
        rssMb: Math.round(mem.rss / 1048576),
        heapMb: Math.round(mem.heapUsed / 1048576),
        loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
        freeMemMb: Math.round(os.freemem() / 1048576),
        totalMemMb: Math.round(os.totalmem() / 1048576),
      },
      db,
      model: { name: this.model.name, state: this.model.state, ...(probe ?? { reachable: false }) },
      counts: counts && {
        conversations: counts[0],
        messages: counts[1],
        memories: counts[2],
        news: counts[3],
        study: counts[4],
        phone: counts[5],
        apiUsage: counts[6],
        vocab: counts[7],
      },
      scrape: sites,
      apiUsage30d: usage.map((u) => ({
        provider: u.provider,
        calls: u._count._all,
        inputTokens: u._sum.inputTokens ?? 0,
        outputTokens: u._sum.outputTokens ?? 0,
      })),
      permissions: { pcControl: s.pcControl, screenRead: s.screenRead, mic: s.mic, webcam: s.webcam },
    };
  }

  async refreshNews() {
    await this.scrape.refresh();
    return { ok: true };
  }

  setPermissions(p: Partial<Permissions>) {
    this.log.warn(`admin permission override: ${JSON.stringify(p)}`);
    return this.settings.setPermissions(p);
  }

  async reset(kind: ResetKind): Promise<{ deleted: number }> {
    const p = this.prisma;
    let r: { count: number };
    switch (kind) {
      case 'conversations':
        r = await p.conversation.deleteMany();
        break;
      case 'memories':
        r = await p.memory.deleteMany();
        break;
      case 'news':
        r = await p.scrapedPost.deleteMany();
        break;
      case 'study':
        r = await p.studySession.deleteMany();
        break;
      case 'phone':
        r = await p.phoneEvent.deleteMany();
        break;
      case 'apiUsage':
        r = await p.apiUsage.deleteMany();
        break;
      case 'vocab':
        // 단어장 삭제 → 카드·기록도 같이 삭제 (cascade). 개수는 카드 수
        r = { count: await p.vocabCard.count() };
        await p.vocabDeck.deleteMany();
        break;
      default:
        throw new BadRequestException({ code: 'BAD_KIND', message: '알 수 없는 항목' });
    }
    this.log.warn(`admin reset ${kind}: ${r.count}`);
    return { deleted: r.count };
  }

  /** 백업 JSON. API 키·메일 토큰(비밀) 제외 */
  async backup() {
    const p = this.prisma;
    const [conversations, memories, settings, shortcuts, newsCategories, newsSites, studySessions, apiPrices, vocabDecks] = await Promise.all([
      p.conversation.findMany({ include: { messages: { orderBy: { createdAt: 'asc' } } } }),
      p.memory.findMany(),
      p.appSettings.findMany(),
      p.webShortcut.findMany(),
      p.newsCategory.findMany(),
      p.newsSite.findMany(),
      p.studySession.findMany(),
      p.apiPrice.findMany(),
      p.vocabDeck.findMany({ include: { cards: { orderBy: { position: 'asc' } } } }),
    ]);
    this.log.log('admin backup exported');
    return { app: 'AURA', version: 1, exportedAt: new Date().toISOString(), conversations, memories, settings, shortcuts, newsCategories, newsSites, studySessions, apiPrices, vocabDecks };
  }
}
