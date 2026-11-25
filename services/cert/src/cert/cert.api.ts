import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { QNET_PAGE } from './qnet';

const DAY = 86_400_000;
const FETCH_TIMEOUT_MS = 20_000;
/** 같은 주소 다시 부르면 저장된 응답 사용 */
export const API_CACHE_MS = 12 * 3_600_000;
const API_CACHE_KEEP_MS = 14 * DAY;
/** API(서비스)별 호출 한도 (개발계정 1,000회/일 기준 보수적으로). 넘기 전에 멈춤 */
export const API_DAY_LIMIT = 800;
export const API_MONTH_LIMIT = 20_000;
/** KST 날짜 YYYY-MM-DD */
export const kstDay = (d = new Date()) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);

export class ApiLimitError extends Error {}

/** 주소 → 호출 한도 묶음 이름 (서비스 단위) */
export function apiOf(url: string): string {
  const u = new URL(url);
  const p = u.pathname.split('/').filter(Boolean);
  if (u.hostname === 'api.odcloud.kr') return `odcloud/${p[1] ?? ''}`;
  // /api/service/rest/InquiryStatSVC/op, /B490007/qualExamSchd/op
  return p.length >= 2 ? p[p.length - 2] : u.hostname;
}

/** 공공데이터 API 호출 (캐시 + API별 한도). 배치 작업만 씀 */
@Injectable()
export class CertApi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async key(): Promise<string | null> {
    const c = await this.prisma.certConfig.findUnique({ where: { id: 1 } });
    return c?.qnetKey ?? this.config.get<string>('QNET_API_KEY') ?? null;
  }

  /** 호출 1회 기록. 한도 넘으면 호출 전에 막음 */
  private async countCall(api: string): Promise<void> {
    const day = kstDay();
    const month = day.slice(0, 7);
    const u = await this.prisma.certApiUsage.findUnique({ where: { api } });
    const dayCount = u?.day === day ? u.dayCount : 0;
    const monthCount = u?.month === month ? u.monthCount : 0;
    if (dayCount >= API_DAY_LIMIT) throw new ApiLimitError(`${api} 오늘 호출 한도(${API_DAY_LIMIT}회) 도달`);
    if (monthCount >= API_MONTH_LIMIT) throw new ApiLimitError(`${api} 이번 달 호출 한도(${API_MONTH_LIMIT}회) 도달`);
    const data = { day, dayCount: dayCount + 1, month, monthCount: monthCount + 1 };
    await this.prisma.certApiUsage.upsert({ where: { api }, create: { api, ...data }, update: data });
  }

  /** 오늘 남은 호출 수 */
  async left(api: string): Promise<number> {
    const u = await this.prisma.certApiUsage.findUnique({ where: { api } });
    const used = u?.day === kstDay() ? u.dayCount : 0;
    return Math.max(0, API_DAY_LIMIT - used);
  }

  /** 오늘·이번 달 전체 호출 수 */
  async usage(): Promise<{ day: number; month: number; byApi: { api: string; day: number }[] }> {
    const day = kstDay();
    const rows = await this.prisma.certApiUsage.findMany();
    return {
      day: rows.reduce((a, r) => a + (r.day === day ? r.dayCount : 0), 0),
      month: rows.reduce((a, r) => a + (r.month === day.slice(0, 7) ? r.monthCount : 0), 0),
      byApi: rows.filter((r) => r.day === day).map((r) => ({ api: r.api, day: r.dayCount })),
    };
  }

  /** 주소 해시 키 캐시 (API 키 안 남음) */
  async fetchText(url: string, ttlMs = API_CACHE_MS): Promise<string> {
    const key = createHash('sha256').update(url).digest('hex');
    const hit = await this.prisma.certApiCache.findUnique({ where: { key } });
    if (hit && Date.now() - hit.at.getTime() < ttlMs) return hit.body;
    await this.countCall(apiOf(url));
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: 'application/json, application/xml' } });
    const text = await res.text();
    if (!res.ok) throw new Error(`공공데이터 API HTTP ${res.status}: ${text.slice(0, 120)}`);
    const at = new Date();
    await this.prisma.certApiCache.upsert({ where: { key }, create: { key, body: text, at }, update: { body: text, at } });
    if (Math.random() < 0.05) await this.prisma.certApiCache.deleteMany({ where: { at: { lt: new Date(at.getTime() - API_CACHE_KEEP_MS) } } });
    return text;
  }

  /** 페이지 나눠 받기. 덜 찬 페이지가 오면 끝 */
  async pages<T>(url: (page: number) => string, parse: (text: string) => T[], size = QNET_PAGE, max = 40, ttlMs = API_CACHE_MS): Promise<T[]> {
    const out: T[] = [];
    for (let page = 1; page <= max; page++) {
      const items = parse(await this.fetchText(url(page), ttlMs));
      out.push(...items);
      if (items.length < size) break;
    }
    return out;
  }
}
