import { Controller, Get, HttpCode, Logger, Post } from '@nestjs/common';
import { BaseModel } from '../ai/models/base-model';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly log = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly model: BaseModel,
  ) {}

  /** db: ok|down, model.reachable: Ollama 접속, installed: pull 여부, loaded: 메모리 적재 */
  @Get()
  async check() {
    const [db, probe] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(
        () => 'ok',
        () => 'down',
      ),
      this.model.probe(),
    ]);
    const ok = db === 'ok' && probe.reachable && probe.installed !== false;
    return { status: ok ? 'ok' : 'degraded', db, model: { name: this.model.name, state: this.model.state, ...probe } };
  }

  /** 모델을 미리 메모리에 올린다. 즉시 202 응답, 적재는 백그라운드. */
  @Post('warmup')
  @HttpCode(202)
  async warmup() {
    if (this.model.state === 'loading') return { state: 'loading' };
    const probe = await this.model.probe();
    if (probe.loaded === true && this.model.state === 'ready') return { state: 'ready' };
    if (!probe.reachable || probe.installed === false) return { state: 'error' };
    this.model.load(true).catch((e: unknown) => this.log.warn(`warmup failed: ${e instanceof Error ? e.message : e}`));
    return { state: 'loading' };
  }
}
