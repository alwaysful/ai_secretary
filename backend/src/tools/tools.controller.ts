import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ToolsService } from './tools.service';

const B64_MAX = 38 * 1024 * 1024;

export class OcrDto {
  /** base64 (data URL 허용) */
  @IsString() @IsNotEmpty() @MaxLength(B64_MAX)
  image!: string;

  @IsOptional() @IsString() @MaxLength(300)
  hint?: string;
}

export class SttDto {
  /** base64 (data URL 허용) */
  @IsString() @IsNotEmpty() @MaxLength(B64_MAX)
  audio!: string;

  @IsString() @MaxLength(100)
  mime!: string;

  /** ko, en ... 비우면 자동 감지 */
  @IsOptional() @IsString() @Matches(/^[a-z]{2,3}$/)
  language?: string;
}

/** 도구 탭. 인증 없음: HOST=127.0.0.1 유지. */
@Controller('tools')
export class ToolsController {
  constructor(private readonly tools: ToolsService) {}

  @Get('status')
  status() {
    return this.tools.status();
  }

  @Post('ocr')
  ocr(@Body() dto: OcrDto) {
    return this.tools.ocr(dto.image, dto.hint);
  }

  @Post('stt')
  stt(@Body() dto: SttDto) {
    return this.tools.transcribe(dto.audio, dto.mime, dto.language);
  }
}
