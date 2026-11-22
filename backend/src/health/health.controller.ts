import { Controller, Get } from '@nestjs/common';
import { BaseModel } from '../ai/models/base-model';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly model: BaseModel,
  ) {}

  @Get()
  async check() {
    const db = await this.prisma.$queryRaw`SELECT 1`.then(
      () => 'ok',
      () => 'down',
    );
    return { status: db === 'ok' ? 'ok' : 'degraded', db, model: { name: this.model.name, state: this.model.state } };
  }
}
