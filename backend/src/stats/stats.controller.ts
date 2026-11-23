import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { IsNumber, Max, Min } from 'class-validator';
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

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    return this.stats.overview(days === '30' ? 30 : 7);
  }

  @Get('api')
  api(@Query('month') month?: string) {
    return this.stats.apiUsage(month);
  }

  @Put('prices/:model')
  setPrice(@Param('model') model: string, @Body() dto: PriceDto) {
    return this.stats.setPrice(model.slice(0, 200), { input: dto.input, output: dto.output });
  }

  @Delete('prices/:model')
  @HttpCode(204)
  resetPrice(@Param('model') model: string) {
    return this.stats.resetPrice(model);
  }
}
