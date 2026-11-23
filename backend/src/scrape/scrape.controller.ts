import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ScrapeService } from './scrape.service';

const KINDS = ['notice', 'contest'] as const;

export class ListPostsQuery {
  @IsOptional() @IsIn(KINDS)
  kind?: 'notice' | 'contest';

  @IsOptional() @IsString() @MaxLength(40)
  source?: string;

  @IsOptional() @Transform(({ value }) => value === 'true' || value === '1' || value === true) @IsBoolean()
  unread?: boolean;

  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;
}

export class MarkSeenDto {
  /** 비우면 전체 (kind 로 범위 제한 가능) */
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true })
  ids?: string[];

  @IsOptional() @IsIn(KINDS)
  kind?: 'notice' | 'contest';
}

export class SetEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

/** 웹 스크래핑 결과 (학사공지·공모전). 인증 없음: HOST=127.0.0.1 유지. */
@Controller('scrape')
export class ScrapeController {
  constructor(private readonly scrape: ScrapeService) {}

  @Get('posts')
  posts(@Query() q: ListPostsQuery) {
    return this.scrape.list(q);
  }

  @Get('unread')
  unread() {
    return this.scrape.unread();
  }

  @Get('sources')
  sources() {
    return this.scrape.status();
  }

  @Post('refresh')
  refresh(@Query('source') source?: string) {
    return this.scrape.refresh(source || undefined);
  }

  @Post('seen')
  seen(@Body() dto: MarkSeenDto) {
    return this.scrape.markSeen(dto.ids, dto.kind);
  }

  @Put('sources/:id')
  setEnabled(@Param('id') id: string, @Body() dto: SetEnabledDto) {
    return this.scrape.setEnabled(id, dto.enabled);
  }
}
