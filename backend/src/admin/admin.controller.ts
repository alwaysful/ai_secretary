import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, Post, Put, Query, Req, UseGuards, BadRequestException, Delete } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { LogLevel } from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard, bearer } from './admin.guard';
import { AdminService, RESET_KINDS, ResetKind } from './admin.service';
import { recentLogs } from './log-buffer';
import { ADMIN_FEATURES, ADMIN_GUIDE, IN_PROGRESS } from './docs';
import { DEFAULT_COMPANION_PROMPT, SettingsService } from '../settings/settings.service';

class LoginDto {
  @IsString() @Length(1, 64)
  code!: string;
}

class CompanionDto {
  /** 빈 문자열 = 기본값 */
  @IsString() @MaxLength(4000)
  prompt!: string;
}

class PermissionsDto {
  @IsOptional() @IsBoolean() pcControl?: boolean;
  @IsOptional() @IsBoolean() screenRead?: boolean;
  @IsOptional() @IsBoolean() mic?: boolean;
  @IsOptional() @IsBoolean() webcam?: boolean;
}

const LEVELS: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];

@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly admin: AdminService,
    private readonly settings: SettingsService,
  ) {}

  /** 관리자 전용 기능 설명·가이드·구현 중 목록 */
  @UseGuards(AdminGuard)
  @Get('docs')
  docs() {
    return { features: ADMIN_FEATURES, guide: ADMIN_GUIDE, inProgress: IN_PROGRESS };
  }

  /** AI 여자친구 성격 */
  @UseGuards(AdminGuard)
  @Get('companion')
  companion() {
    return this.companionView();
  }

  @UseGuards(AdminGuard)
  @Put('companion')
  async setCompanion(@Body() dto: CompanionDto) {
    await this.settings.update({ companionPrompt: dto.prompt });
    return this.companionView();
  }

  private companionView() {
    return { prompt: this.settings.companionPrompt(), default: DEFAULT_COMPANION_PROMPT };
  }

  @Post('login')
  @HttpCode(200)
  login(@Req() req: Request, @Body() dto: LoginDto) {
    return this.auth.login(dto.code, req.socket.remoteAddress ?? '?');
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: Request) {
    this.auth.logout(bearer(req));
  }

  /** 세션 유효 확인 (관리자 로비 표시용) */
  @UseGuards(AdminGuard)
  @Get('session')
  session() {
    return { ok: true };
  }

  @UseGuards(AdminGuard)
  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @UseGuards(AdminGuard)
  @Get('logs')
  logs(@Query('limit') limit?: string, @Query('level') level?: string) {
    const n = Math.min(300, Math.max(1, Number(limit) || 100));
    const lv = (level ?? '').split(',').filter((l): l is LogLevel => LEVELS.includes(l as LogLevel));
    return recentLogs(n, lv);
  }

  @UseGuards(AdminGuard)
  @Post('scrape/refresh')
  @HttpCode(200)
  refresh() {
    return this.admin.refreshNews();
  }

  /** 권한 강제 변경 (원격에서도 켜기 허용) */
  @UseGuards(AdminGuard)
  @Put('permissions')
  permissions(@Body() dto: PermissionsDto) {
    return this.admin.setPermissions(dto);
  }

  /** 데이터 초기화. ?confirm=<kind> 필수 */
  @UseGuards(AdminGuard)
  @Delete('data/:kind')
  reset(@Param('kind', new ParseEnumPipe(Object.fromEntries(RESET_KINDS.map((k) => [k, k])))) kind: ResetKind, @Query('confirm') confirm?: string) {
    if (confirm !== kind) throw new BadRequestException({ code: 'CONFIRM_REQUIRED', message: '확인값 불일치' });
    return this.admin.reset(kind);
  }

  @UseGuards(AdminGuard)
  @Get('backup')
  backup() {
    return this.admin.backup();
  }
}
