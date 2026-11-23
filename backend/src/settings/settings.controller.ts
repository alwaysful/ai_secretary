import { Body, Controller, ForbiddenException, Get, Put, Req } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { isLocalRequest } from '../system/system.controller';
import { SettingsService } from './settings.service';

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(200)
  model?: string;

  /** 빈 문자열 = 기본값 */
  @IsOptional() @IsString() @MaxLength(4000)
  systemPrompt?: string;
}

export class PermissionsDto {
  @IsOptional() @IsBoolean()
  pcControl?: boolean;

  @IsOptional() @IsBoolean()
  screenRead?: boolean;
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

  /** PC 조작·화면 읽기 스위치. 켜기는 PC에서만, 끄기는 어디서든 */
  @Put('permissions')
  permissions(@Req() req: Request, @Body() dto: PermissionsDto) {
    if ((dto.pcControl || dto.screenRead) && !isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'])) {
      throw new ForbiddenException({ code: 'LOCAL_ONLY', message: '켜기는 PC에서만' });
    }
    return this.settings.setPermissions(dto);
  }

  /** Ollama에 설치된 모델 */
  @Get('models')
  models() {
    return this.settings.models();
  }
}
