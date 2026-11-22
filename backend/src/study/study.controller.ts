import { Body, Controller, Get, HttpCode, Post, Put, Query } from '@nestjs/common';
import { ScreenCheckDto, ScreenCheckResponseDto } from './dto/screen-check.dto';
import { StatsQueryDto, StudySessionDto } from './dto/session.dto';
import { StudyStatsService } from './study-stats.service';
import { StudyService } from './study.service';

/** 로컬 단일 사용자. 쿨다운 키 고정. */
@Controller('study')
export class StudyController {
  constructor(
    private readonly study: StudyService,
    private readonly statsService: StudyStatsService,
  ) {}

  @Post('screen-check')
  @HttpCode(200)
  screenCheck(@Body() body: ScreenCheckDto): Promise<ScreenCheckResponseDto> {
    return this.study.check('local', body.image);
  }

  /** 세션 저장 (진행 중 주기 저장 + 종료 시) */
  @Put('sessions')
  saveSession(@Body() body: StudySessionDto) {
    return this.statsService.save(body);
  }

  /** 일·주별 집중 시간, 위반 횟수 */
  @Get('stats')
  stats(@Query() q: StatsQueryDto) {
    return this.statsService.stats(q.unit, q.count);
  }
}
