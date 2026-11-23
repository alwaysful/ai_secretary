import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PhoneEventDto } from './dto/phone.dto';

/** PC 세션 heartbeat 유효 시간 */
const LIVE_MS = 90_000;
const RECENT_MS = 3_600_000;

/** 폰 감시: PC 공부 세션 상태 + 폰 딴짓 기록 */
@Injectable()
export class PhoneService {
  private liveAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  /** PC 공부 화면이 주기적으로 호출 (active=false 면 즉시 종료) */
  heartbeat(active: boolean): { active: boolean } {
    this.liveAt = active ? Date.now() : 0;
    return this.live();
  }

  live(): { active: boolean } {
    return { active: Date.now() - this.liveAt < LIVE_MS };
  }

  record(dto: PhoneEventDto) {
    return this.prisma.phoneEvent.create({ data: { package: dto.package, label: dto.label } });
  }

  /** since 이후 기록 (없으면 최근 1시간) */
  list(since?: string) {
    const from = since ? new Date(since) : new Date(Date.now() - RECENT_MS);
    return this.prisma.phoneEvent.findMany({ where: { at: { gt: from } }, orderBy: { at: 'asc' }, take: 100 });
  }
}
