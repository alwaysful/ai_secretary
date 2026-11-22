import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SettingsService } from './settings.service';

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(200)
  model?: string;

  /** 빈 문자열 = 기본값 */
  @IsOptional() @IsString() @MaxLength(4000)
  systemPrompt?: string;
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

  /** Ollama에 설치된 모델 */
  @Get('models')
  models() {
    return this.settings.models();
  }
}
