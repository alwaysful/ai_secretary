import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Emotion, EMOTIONS, TTS_ENGINES, TtsEngine } from '../ai/providers/tts';
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

  /** mic = 마이크 녹음 (마이크 스위치 적용), file = 파일 업로드 */
  @IsOptional() @IsIn(['mic', 'file'])
  source?: 'mic' | 'file';
}

export class TtsDto {
  @IsString() @IsNotEmpty() @MaxLength(20000)
  text!: string;

  /** 비우면 설정값 (미리 듣기용 덮어쓰기) */
  @IsOptional() @IsIn([...TTS_ENGINES])
  engine?: TtsEngine;

  @IsOptional() @IsString() @MaxLength(200)
  model?: string;

  @IsOptional() @IsString() @MaxLength(200)
  voice?: string;

  @IsOptional() @IsNumber() @Min(0.5) @Max(2)
  rate?: number;

  /** 감정 (기본 neutral) */
  @IsOptional() @IsIn([...EMOTIONS])
  emotion?: Emotion;
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
    return this.tools.transcribe(dto.audio, dto.mime, dto.language, dto.source);
  }

  /** 텍스트 → 음성 base64 */
  @Post('tts')
  tts(@Body() dto: TtsDto) {
    return this.tools.speak(dto.text, dto);
  }
}
