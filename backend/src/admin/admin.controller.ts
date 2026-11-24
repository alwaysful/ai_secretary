import { Body, Controller, Get, HttpCode, Logger, Param, ParseEnumPipe, Post, Put, Query, Req, Res, UseGuards, BadRequestException, Delete, NotFoundException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import type { LogLevel } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard, bearer } from './admin.guard';
import { AdminService, RESET_KINDS, ResetKind } from './admin.service';
import { recentLogs } from './log-buffer';
import { ADMIN_FEATURES, ADMIN_GUIDE, IN_PROGRESS } from './docs';
import { SettingsService } from '../settings/settings.service';
import { CompanionService } from './companion.service';
import { UpdateService } from './update.service';
import { stopAll } from '../system/system.controller';

class LoginDto {
  @IsString() @Length(1, 64)
  code!: string;
}

class CompanionDto {
  /** 빈 문자열 = 기본값 */
  @IsString() @MaxLength(4000)
  prompt!: string;
}

class VoiceDto {
  @IsString() @MaxLength(40)
  name!: string;

  @IsIn(['browser', 'edge', 'openai', 'gemini'])
  engine!: 'browser' | 'edge' | 'openai' | 'gemini';

  @IsOptional() @IsString() @MaxLength(120)
  model?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  voice?: string | null;

  @IsNumber() @Min(0.5) @Max(2)
  rate!: number;

  @IsString() @MaxLength(20)
  emotion!: string;
}

class ActiveVoiceDto {
  @IsOptional() @ValidateNested() @Type(() => VoiceDto)
  voice!: VoiceDto | null;
}

class PersonaDto {
  @IsString() @Length(1, 40)
  name!: string;

  @IsString() @Length(1, 4000)
  prompt!: string;
}

class ModelPickDto {
  @IsOptional() @IsString() @MaxLength(64)
  id!: string | null;
}

class Live2dUploadDto {
  @IsString() @MaxLength(60)
  name!: string;

  /** zip base64 (최대 약 30MB) */
  @IsString() @MaxLength(40 * 1024 * 1024)
  zip!: string;
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
    private readonly companionSvc: CompanionService,
    private readonly updates: UpdateService,
  ) {}

  private readonly log = new Logger(AdminController.name);

  /** 관리자 전용 기능 설명·가이드·구현 중 목록 */
  @UseGuards(AdminGuard)
  @Get('docs')
  docs() {
    return { features: ADMIN_FEATURES, guide: ADMIN_GUIDE, inProgress: IN_PROGRESS };
  }

  /** AI 여자친구: 성격·목소리 프리셋, Live2D 모델 */
  @UseGuards(AdminGuard)
  @Get('companion')
  companion() {
    return this.companionSvc.view();
  }

  @UseGuards(AdminGuard)
  @Put('companion')
  async setCompanion(@Body() dto: CompanionDto) {
    await this.settings.update({ companionPrompt: dto.prompt });
    return this.companionSvc.view();
  }

  @UseGuards(AdminGuard)
  @Put('companion/voice')
  setVoice(@Body() dto: ActiveVoiceDto) {
    return this.companionSvc.setVoice(dto.voice ? { id: 'active', ...dto.voice } : null);
  }

  @UseGuards(AdminGuard)
  @Put('companion/model')
  setModel(@Body() dto: ModelPickDto) {
    return this.companionSvc.setModel(dto.id ?? null);
  }

  @UseGuards(AdminGuard)
  @Post('companion/presets/persona')
  addPersona(@Body() dto: PersonaDto) {
    return this.companionSvc.addPreset('persona', { name: dto.name, prompt: dto.prompt });
  }

  @UseGuards(AdminGuard)
  @Post('companion/presets/voice')
  addVoice(@Body() dto: VoiceDto) {
    return this.companionSvc.addPreset('voice', { ...dto });
  }

  @UseGuards(AdminGuard)
  @Delete('companion/presets/:kind/:id')
  deletePreset(@Param('kind', new ParseEnumPipe({ persona: 'persona', voice: 'voice' })) kind: 'persona' | 'voice', @Param('id') id: string) {
    return this.companionSvc.deletePreset(kind, id);
  }

  @UseGuards(AdminGuard)
  @Post('live2d')
  uploadLive2d(@Body() dto: Live2dUploadDto) {
    return this.companionSvc.upload(dto.name, dto.zip);
  }

  @UseGuards(AdminGuard)
  @Delete('live2d/:id')
  deleteLive2d(@Param('id') id: string) {
    return this.companionSvc.removeModel(id);
  }

  /** 업데이트 확인 (git fetch) */
  @UseGuards(AdminGuard)
  @Get('update')
  updateStatus() {
    return this.updates.status();
  }

  /** git pull (+ 의존성 바뀌면 npm install) */
  @UseGuards(AdminGuard)
  @Post('update')
  @HttpCode(200)
  update() {
    return this.updates.pull();
  }

  /** 새 창에서 start-aura 다시 실행 후 현재 서버 종료 */
  @UseGuards(AdminGuard)
  @Post('restart')
  @HttpCode(202)
  restart() {
    return this.updates.restart(() => stopAll(this.log));
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

/** Live2D 모델 정적 파일. 렌더러가 상대 경로로 텍스처·모션 불러와서 토큰 없이 제공 (업로드·삭제만 관리자) */
@Controller('live2d')
export class Live2dController {
  constructor(private readonly companion: CompanionService) {}

  @Get(':id/*path')
  file(@Param('id') id: string, @Param('path') path: string | string[], @Res() res: Response) {
    const rel = Array.isArray(path) ? path.join('/') : path;
    const f = this.companion.file(id, decodeURIComponent(rel));
    if (!f) throw new NotFoundException({ code: 'NOT_FOUND', message: '파일 없음' });
    res.type(f.type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(f.path);
  }
}
