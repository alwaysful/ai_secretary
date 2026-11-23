import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ScrapeService } from './scrape.service';

export class FeedQueryDto {
  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsString() @MaxLength(30)
  tag?: string;

  @IsOptional() @Transform(({ value }) => value === 'true' || value === '1' || value === true) @IsBoolean()
  unread?: boolean;

  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(300)
  limit?: number;
}

export class CalendarQueryDto {
  @Type(() => Date) @IsDate()
  from!: Date;

  @Type(() => Date) @IsDate()
  to!: Date;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsString() @MaxLength(30)
  tag?: string;
}

export class MarkSeenDto {
  /** 비우면 전체 (categoryId 로 범위 제한 가능) */
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true })
  ids?: string[];

  @IsOptional() @IsUUID()
  categoryId?: string;
}

export class CategoryDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  name!: string;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(40)
  name?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  position?: number;
}

export class SiteDto {
  @IsOptional() @IsString() @MaxLength(60)
  name?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(2000)
  url?: string;

  @IsOptional() @IsString() @MaxLength(20)
  parser?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300)
  itemSelector?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  categoryId?: string | null;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class CreateSiteDto extends SiteDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  declare url: string;
}

export class PreviewDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  url!: string;

  @IsOptional() @IsString() @MaxLength(20)
  parser?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300)
  itemSelector?: string | null;
}

/** 새 소식 (웹 스크래핑). 인증 없음: HOST=127.0.0.1 유지. */
@Controller('scrape')
export class ScrapeController {
  constructor(private readonly scrape: ScrapeService) {}

  @Get('feed')
  feed(@Query() q: FeedQueryDto) {
    return this.scrape.feed(q);
  }

  @Get('calendar')
  calendar(@Query() q: CalendarQueryDto) {
    if (q.to <= q.from || q.to.getTime() - q.from.getTime() > 100 * 86_400_000) {
      throw new BadRequestException({ code: 'BAD_RANGE', message: '기간은 100일 이하' });
    }
    return this.scrape.calendar(q);
  }

  @Get('unread')
  unread() {
    return this.scrape.unread();
  }

  @Post('seen')
  seen(@Body() dto: MarkSeenDto) {
    return this.scrape.markSeen(dto.ids, dto.categoryId);
  }

  @Post('refresh')
  refresh(@Query('site') site?: string) {
    return this.scrape.refresh(site || undefined);
  }

  @Get('tags')
  tags() {
    return this.scrape.tags();
  }

  @Get('parsers')
  parsers() {
    return this.scrape.parsers();
  }

  @Post('preview')
  preview(@Body() dto: PreviewDto) {
    return this.scrape.preview(dto);
  }

  @Get('categories')
  categories() {
    return this.scrape.categories();
  }

  @Post('categories')
  createCategory(@Body() dto: CategoryDto) {
    return this.scrape.createCategory(dto.name);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.scrape.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.scrape.deleteCategory(id);
  }

  @Post('sites')
  createSite(@Body() dto: CreateSiteDto) {
    return this.scrape.createSite({ ...dto, name: dto.name ?? '' });
  }

  @Patch('sites/:id')
  updateSite(@Param('id') id: string, @Body() dto: SiteDto) {
    return this.scrape.updateSite(id, dto);
  }

  @Delete('sites/:id')
  deleteSite(@Param('id') id: string) {
    return this.scrape.deleteSite(id);
  }
}
