import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { localNow } from '../calendar/tz';
import { EnvVars } from '../config/env';
import { ModelError } from '../ai/models/base-model';
import { setApiGate } from '../ai/providers/api-providers';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from './stats.service';

export interface BudgetInput {
  limitUsd: number | null;
  warnPct: number;
  block: boolean;
}

export interface BudgetStatus extends BudgetInput {
  month: string;
  costUsd: number;
  /** 한도 대비 % (한도 없으면 null) */
  pct: number | null;
  level: 'none' | 'ok' | 'warn' | 'over';
}

/** 외부 API 월 비용 한도·경고. 차단 켜면 한도 넘을 때 API 호출 거부 */
@Injectable()
export class BudgetService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BudgetService.name);
  private cfg: BudgetInput = { limitUsd: null, warnPct: 80, block: false };
  private cost = 0;
  private month = '';
  private timer: NodeJS.Timeout | null = null;
  private readonly notified = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const row = await this.prisma.appSettings.findUnique({ where: { id: 1 }, select: { budgetUsd: true, budgetWarnPct: true, budgetBlock: true } });
      if (row) this.cfg = { limitUsd: row.budgetUsd, warnPct: row.budgetWarnPct, block: row.budgetBlock };
    } catch (e) {
      this.log.warn(`예산 설정 로드 실패: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    }
    await this.refresh();
    setApiGate(() => this.check());
  }

  onModuleDestroy(): void {
    setApiGate(null);
    if (this.timer) clearTimeout(this.timer);
  }

  private curMonth(): string {
    const n = localNow(new Date(), this.config.get('TIMEZONE', { infer: true }));
    return `${n.y}-${String(n.m).padStart(2, '0')}`;
  }

  /** 이번 달 비용 다시 계산 */
  async refresh(): Promise<void> {
    try {
      const r = await this.stats.apiUsage();
      this.cost = r.total.cost;
      this.month = r.month;
      this.notify();
    } catch (e) {
      this.log.warn(`예산 계산 실패: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    }
  }

  /** 사용량 기록·단가 변경 후 호출 (2초 모아서 재계산) */
  bump(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, 2000);
  }

  private check(): void {
    const m = this.curMonth();
    if (m !== this.month) {
      this.month = m;
      this.cost = 0;
      void this.refresh();
    }
    const { limitUsd, block } = this.cfg;
    if (block && limitUsd !== null && this.cost >= limitUsd) {
      throw new ModelError('UNAVAILABLE', `월 API 비용 한도 도달 ($${this.cost.toFixed(2)} / $${limitUsd}). 통계 → API 비용 한도에서 변경`);
    }
  }

  private notify(): void {
    const s = this.status();
    if (s.level !== 'warn' && s.level !== 'over') return;
    const key = `${s.month}:${s.level}`;
    if (this.notified.has(key)) return;
    this.notified.add(key);
    this.log.warn(`API 비용 ${s.level === 'over' ? '한도 초과' : '경고'}: $${s.costUsd.toFixed(2)} / $${s.limitUsd} (${s.pct}%)`);
  }

  status(): BudgetStatus {
    const { limitUsd, warnPct } = this.cfg;
    const pct = limitUsd ? Math.round((this.cost / limitUsd) * 1000) / 10 : null;
    const level: BudgetStatus['level'] = limitUsd === null ? 'none' : this.cost >= limitUsd ? 'over' : pct !== null && pct >= warnPct ? 'warn' : 'ok';
    return { ...this.cfg, month: this.month || this.curMonth(), costUsd: Math.round(this.cost * 10000) / 10000, pct, level };
  }

  async set(input: BudgetInput): Promise<BudgetStatus> {
    const data = { budgetUsd: input.limitUsd, budgetWarnPct: input.warnPct, budgetBlock: input.block };
    await this.prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    this.cfg = { ...input };
    this.notified.clear();
    await this.refresh();
    return this.status();
  }
}
