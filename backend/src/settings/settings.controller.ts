import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TTS_ENGINES, TtsEngine } from '../ai/providers/tts';
import { AiFeature, API_PROVIDERS, ApiProvider, isProvider } from '../ai/providers/api-providers';
import type { Request } from 'express';
import { isLocalRequest } from '../system/system.controller';
import { SettingsService, STT_MODELS } from './settings.service';

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(200)
  model?: string;

  /** 빈 문자열 = 기본값 */
  @IsOptional() @IsString() @MaxLength(4000)
  systemPrompt?: string;

  /** 빈 문자열 = .env 기본값 */
  @IsOptional() @IsString() @MaxLength(200)
  ocrModel?: string;

  /** 빈 문자열 = .env 기본값 */
  @IsOptional() @IsString() @MaxLength(50)
  sttModel?: string;

  /** AI 여자친구 성격. 빈 문자열 = 기본값 */
  @IsOptional() @IsString() @MaxLength(4000)
  companionPrompt?: string;
}

export class TtsDto {
  @IsOptional() @IsIn([...TTS_ENGINES])
  engine?: TtsEngine;

  /** 빈 문자열 = 기본 */
  @IsOptional() @IsString() @MaxLength(200)
  model?: string;

  @IsOptional() @IsString() @MaxLength(200)
  voice?: string;

  @IsOptional() @IsNumber() @Min(0.5) @Max(2)
  rate?: number;

  @IsOptional() @IsBoolean()
  autoRead?: boolean;
}

export class PermissionsDto {
  @IsOptional() @IsBoolean()
  pcControl?: boolean;

  @IsOptional() @IsBoolean()
  screenRead?: boolean;

  @IsOptional() @IsBoolean()
  mic?: boolean;

  @IsOptional() @IsBoolean()
  webcam?: boolean;
}

export class RouteDto {
  @IsIn(['chat', 'ocr', 'stt'])
  feature!: AiFeature;

  @IsIn(['local', 'api'])
  source!: 'local' | 'api';

  @IsOptional() @IsIn([...API_PROVIDERS])
  provider?: ApiProvider;

  @IsOptional() @IsString() @MaxLength(200)
  model?: string;
}

export class ApiKeyDto {
  @IsOptional() @IsString() @MaxLength(500)
  key?: string;
}

function provider(p: string): ApiProvider {
  if (!isProvider(p)) throw new BadRequestException({ code: 'BAD_PROVIDER', message: `알 수 없는 공급자: ${p}` });
  return p;
}

function localOnly(req: Request): void {
  if (!isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'])) {
    throw new ForbiddenException({ code: 'LOCAL_ONLY', message: 'API 키는 PC에서만 입력·변경 가능' });
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  /** PC 조작·화면 읽기·마이크·웹캠 스위치. 켜기는 PC에서만, 끄기는 어디서든 */
  @Put('permissions')
  permissions(@Req() req: Request, @Body() dto: PermissionsDto) {
    if ((dto.pcControl || dto.screenRead || dto.mic || dto.webcam) && !isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'])) {
      throw new ForbiddenException({ code: 'LOCAL_ONLY', message: '켜기는 PC에서만' });
    }
    return this.settings.setPermissions(dto);
  }

  /** Ollama에 설치된 모델 */
  @Get('models')
  models() {
    return this.settings.models();
  }

  /** 이미지 입력 가능한 Ollama 모델 (OCR용) */
  @Get('vision-models')
  visionModels() {
    return this.settings.visionModels();
  }

  /** 기능별 로컬/API 선택 */
  @Put('route')
  route(@Body() dto: RouteDto) {
    return this.settings.setRoute(dto.feature, dto.source, dto.provider, dto.model);
  }

  /** 공급자 모델 목록 (키 있으면 실시간) */
  @Get('api-models')
  apiModels(@Query('provider') p: string, @Query('feature') f: string) {
    if (!['chat', 'ocr', 'stt'].includes(f)) throw new BadRequestException({ code: 'BAD_FEATURE', message: f });
    return this.settings.apiModels(provider(p), f as AiFeature);
  }

  /** API 키 저장 (암호화). 응답엔 마스킹만 */
  @Put('api-keys/:provider')
  setKey(@Req() req: Request, @Param('provider') p: string, @Body() dto: ApiKeyDto) {
    localOnly(req);
    return this.settings.setKey(provider(p), dto.key ?? '');
  }

  @Delete('api-keys/:provider')
  deleteKey(@Param('provider') p: string) {
    return this.settings.deleteKey(provider(p));
  }

  /** 연결 테스트. body.key 없으면 저장된 키 */
  @Post('api-keys/:provider/test')
  @HttpCode(200)
  testKey(@Req() req: Request, @Param('provider') p: string, @Body() dto: ApiKeyDto) {
    if (dto.key) localOnly(req);
    return this.settings.testKey(provider(p), dto.key);
  }

  /** TTS 엔진·모델·목소리·속도·자동 읽기 */
  @Put('tts')
  tts(@Body() dto: TtsDto) {
    return this.settings.setTts(dto);
  }

  /** TTS 엔진별 모델·목소리 목록 (browser 제외: 브라우저가 목록 제공) */
  @Get('tts-options')
  ttsOptions(@Query('engine') engine: string) {
    if (!['edge', 'openai', 'gemini'].includes(engine)) throw new BadRequestException({ code: 'BAD_ENGINE', message: engine });
    return this.settings.ttsOptions(engine as 'edge' | 'openai' | 'gemini');
  }

  /** faster-whisper 모델 크기 */
  @Get('stt-models')
  sttModels() {
    return [...STT_MODELS];
  }
}
