import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { BudgetService } from './budget.service';
import { StatsService } from './stats.service';

class PriceDto {
  @IsNumber()
  @Min(0)
  @Max(10_000)
  input!: number;

  @IsNumber()
  @Min(0)
  @Max(10_000)
  output!: number;
}

class BudgetDto {
  /** null = 한도 없음 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  limitUsd!: number | null;

  @IsInt()
  @Min(10)
  @Max(100)
  warnPct!: number;

  @IsBoolean()
  block!: boolean;
}

@Controller('stats')
export class StatsController {
  constructor(
    private readonly stats: StatsService,
    private readonly budget: BudgetService,
  ) {}

  /** 월 비용 한도·경고 상태 */
  @Get('budget')
  getBudget() {
    return this.budget.status();
  }

  @Put('budget')
  setBudget(@Body() dto: BudgetDto) {
    return this.budget.set({ limitUsd: dto.limitUsd ?? null, warnPct: dto.warnPct, block: dto.block });
  }

  @Get('overview')
  overview(@Query('days') days?: string) {
    return this.stats.overview(days === '30' ? 30 : 7);
  }

  @Get('api')
  api(@Query('month') month?: string) {
    return this.stats.apiUsage(month);
  }

  @Put('prices/:model')
  async setPrice(@Param('model') model: string, @Body() dto: PriceDto) {
    const r = await this.stats.setPrice(model.slice(0, 200), { input: dto.input, output: dto.output });
    this.budget.bump();
    return r;
  }

  @Delete('prices/:model')
  @HttpCode(204)
  async resetPrice(@Param('model') model: string) {
    await this.stats.resetPrice(model);
    this.budget.bump();
  }
}
