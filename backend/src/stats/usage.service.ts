import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { onApiUsage, UsageRecord } from '../ai/providers/api-providers';
import { PrismaService } from '../prisma/prisma.service';

/** 외부 API 호출 토큰 사용량을 DB에 기록 */
@Injectable()
export class UsageService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    onApiUsage((u) => void this.save(u));
  }

  onModuleDestroy(): void {
    onApiUsage(null);
  }

  private async save(u: UsageRecord): Promise<void> {
    try {
      await this.prisma.apiUsage.create({
        data: { provider: u.provider, model: u.model, feature: u.feature, inputTokens: u.inputTokens, outputTokens: u.outputTokens, audioSec: u.audioSec ?? 0 },
      });
    } catch (e) {
      this.log.warn(`API 사용량 기록 실패: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    }
  }
}
