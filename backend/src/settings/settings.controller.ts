import { Body, Controller, ForbiddenException, Get, Put, Req } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
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

  /** faster-whisper 모델 크기 */
  @Get('stt-models')
  sttModels() {
    return [...STT_MODELS];
  }
}
