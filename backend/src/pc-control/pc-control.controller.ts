import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Equals, IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { isLocalRequest } from '../system/system.controller';
import { PcControlService } from './pc-control.service';

export class StartRunDto {
  @IsString() @MinLength(1) @MaxLength(500)
  goal!: string;

  /** 사용자가 확인 창에서 동의함 */
  @IsBoolean() @Equals(true)
  confirm!: boolean;
}

function local(req: Request): void {
  if (!isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'])) {
    throw new ForbiddenException({ code: 'LOCAL_ONLY', message: 'PC 조작은 PC에서만' });
  }
}

/** AI PC 조작. 모두 PC(localhost)에서만. */
@Controller('pc-control')
export class PcControlController {
  constructor(private readonly pc: PcControlService) {}

  @Get('check')
  check(@Req() req: Request) {
    local(req);
    return this.pc.check();
  }

  @Get('runs/current')
  current(@Req() req: Request) {
    local(req);
    return { run: this.pc.current() };
  }

  @Post('runs')
  start(@Req() req: Request, @Body() dto: StartRunDto) {
    local(req);
    return this.pc.start(dto.goal);
  }

  /** 정지는 어디서든 허용 (폰에서 급정지) */
  @Post('runs/current/cancel')
  @HttpCode(200)
  cancel() {
    return { run: this.pc.cancel() };
  }
}
