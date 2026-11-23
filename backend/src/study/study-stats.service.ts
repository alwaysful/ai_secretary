import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { StatsBucket, StudySessionDto } from './dto/session.dto';

const DAY_MS = 86_400_000;
const KEYS = ['focusSec', 'pomodoros', 'posture', 'phone', 'slack', 'sleep'] as const;

/** 시간대 기준 YYYY-MM-DD */
export function localDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}

/** YYYY-MM-DD 문자열 날짜 연산 (UTC 기준 순수 달력 계산) */
function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** 해당 날짜가 속한 주의 월요일 */
export function weekStart(ymd: string): string {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0=일
  return addDays(ymd, -((dow + 6) % 7));
}

/** 세션 목록 → 일/주 버킷 (빈 버킷 0 채움, 오래된 순) */
export function bucketize(
  sessions: (Pick<StatsBucket, (typeof KEYS)[number]> & { startedAt: Date })[],
  unit: 'day' | 'week',
  count: number,
  tz: string,
  now: Date,
  phoneEvents: Date[] = [],
): StatsBucket[] {
  const today = localDate(now, tz);
  const last = unit === 'day' ? today : weekStart(today);
  const step = unit === 'day' ? 1 : 7;
  const buckets = new Map<string, StatsBucket>();
  for (let i = count - 1; i >= 0; i--) {
    const date = addDays(last, -i * step);
    buckets.set(date, { date, focusSec: 0, pomodoros: 0, posture: 0, phone: 0, slack: 0, sleep: 0, phoneApp: 0 });
  }
  for (const s of sessions) {
    const d = localDate(s.startedAt, tz);
    const b = buckets.get(unit === 'day' ? d : weekStart(d));
    if (!b) continue;
    for (const k of KEYS) b[k] += s[k];
  }
  for (const at of phoneEvents) {
    const d = localDate(at, tz);
    const b = buckets.get(unit === 'day' ? d : weekStart(d));
    if (b) b.phoneApp += 1;
  }
  return [...buckets.values()];
}

@Injectable()
export class StudyStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  save(dto: StudySessionDto) {
    const data = {
      startedAt: new Date(dto.startedAt),
      endedAt: new Date(dto.endedAt),
      focusSec: dto.focusSec,
      pomodoros: dto.pomodoros,
      posture: dto.posture,
      phone: dto.phone,
      slack: dto.slack,
      sleep: dto.sleep,
    };
    return this.prisma.studySession.upsert({
      where: { id: dto.id },
      create: { id: dto.id, ...data },
      update: data,
    });
  }

  async stats(unit: 'day' | 'week' = 'day', count = unit === 'day' ? 7 : 8): Promise<StatsBucket[]> {
    const tz = this.config.get('TIMEZONE', { infer: true });
    const now = new Date();
    // 시간대 차이 여유로 하루 더 조회
    const since = new Date(now.getTime() - (count * (unit === 'day' ? 1 : 7) + 1) * DAY_MS);
    const [sessions, events] = await Promise.all([
      this.prisma.studySession.findMany({
        where: { startedAt: { gte: since } },
        select: { startedAt: true, focusSec: true, pomodoros: true, posture: true, phone: true, slack: true, sleep: true },
      }),
      this.prisma.phoneEvent.findMany({ where: { at: { gte: since } }, select: { at: true } }),
    ]);
    return bucketize(sessions, unit, count, tz, now, events.map((e) => e.at));
  }
}
