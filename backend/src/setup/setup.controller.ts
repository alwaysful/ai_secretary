import { Controller, ForbiddenException, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { isLocalRequest } from '../system/system.controller';
import { SetupService } from './setup.service';

@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get('jobs')
  jobs() {
    return this.setup.list();
  }

  /** 시작 가이드 자동 진행. PC(localhost)에서만, X-Aura-Setup 헤더 필수(CSRF 차단) */
  @Post('run/:task')
  @HttpCode(202)
  run(@Param('task') task: string, @Req() req: Request, @Headers('x-aura-setup') confirm?: string) {
    if (confirm !== '1') throw new ForbiddenException({ code: 'CONFIRM_REQUIRED', message: '확인 헤더 없음' });
    if (!isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'])) {
      throw new ForbiddenException({ code: 'LOCAL_ONLY', message: 'PC에서만 실행 가능' });
    }
    return this.setup.run(task);
  }
}
