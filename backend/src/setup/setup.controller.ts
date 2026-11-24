import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Logger, Param, Post, Req } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { isLocalRequest, stopAll } from '../system/system.controller';
import { restartAura } from '../admin/update.service';
import { SetupService } from './setup.service';

class OutlookDto {
  @IsString() @MaxLength(64)
  clientId!: string;
}

function guard(req: Request, confirm?: string): void {
  if (confirm !== '1') throw new ForbiddenException({ code: 'CONFIRM_REQUIRED', message: '확인 헤더 없음' });
  if (!isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'])) {
    throw new ForbiddenException({ code: 'LOCAL_ONLY', message: 'PC에서만 실행 가능' });
  }
}

@Controller('setup')
export class SetupController {
  private readonly log = new Logger(SetupController.name);

  constructor(private readonly setup: SetupService) {}

  @Get('jobs')
  jobs() {
    return this.setup.list();
  }

  /** 시작 가이드 자동 진행. PC(localhost)에서만, X-Aura-Setup 헤더 필수(CSRF 차단) */
  @Post('run/:task')
  @HttpCode(202)
  run(@Param('task') task: string, @Req() req: Request, @Headers('x-aura-setup') confirm?: string) {
    guard(req, confirm);
    return this.setup.run(task);
  }

  /** Outlook 연동 .env 저장 후 AURA 재시작 (설정은 시작 때만 읽음) */
  @Post('outlook')
  @HttpCode(202)
  outlook(@Body() dto: OutlookDto, @Req() req: Request, @Headers('x-aura-setup') confirm?: string) {
    guard(req, confirm);
    this.setup.saveOutlook(dto.clientId);
    return restartAura(this.log, () => stopAll(this.log));
  }
}
