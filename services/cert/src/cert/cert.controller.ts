import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDate, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { CertBatch, JOB_EVERY } from './cert.batch';
import { CertService } from './cert.service';

const emptyNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

export class CertFilterDto {
  @IsOptional() @IsString() @MaxLength(30)
  field?: string;

  @IsOptional() @IsString() @MaxLength(20)
  kind?: string;

  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  /** AURA 별표 거르기 */
  @IsOptional() @IsArray() @ArrayMaxSize(50_000) @IsString({ each: true })
  ids?: string[];
}

export class CertCalendarDto extends CertFilterDto {
  @Type(() => Date) @IsDate()
  from!: Date;

  @Type(() => Date) @IsDate()
  to!: Date;
}

export class CertKeyDto {
  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300)
  key?: string | null;
}

export class CertPlaceDto {
  @IsString() @Matches(/^\d{2}$/)
  brch!: string;
}

class ScoreItem {
  @IsString() @MaxLength(80) name!: string;
  @IsString() @MaxLength(20) kind!: string;
  @IsOptional() @IsString() @MaxLength(30) grade!: string | null;
  @IsString() @MaxLength(30) field!: string;
}

export class ScoreDto {
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => ScoreItem)
  items!: ScoreItem[];
}

export class RunDto {
  @IsArray() @IsIn(Object.keys(JOB_EVERY), { each: true })
  jobs!: string[];
}

/** 자격증 정보 API. 읽기는 DB만, 수집은 배치 */
@Controller('certs')
export class CertController {
  constructor(
    private readonly certs: CertService,
    private readonly batch: CertBatch,
  ) {}

  @Get('meta')
  meta() {
    return this.certs.meta();
  }

  /** 목록 (ids 가 길 수 있어 POST) */
  @Post('query')
  list(@Body() q: CertFilterDto) {
    return this.certs.list(q);
  }

  @Post('calendar')
  calendar(@Body() q: CertCalendarDto) {
    return this.certs.calendar(q);
  }

  @Post('score')
  score(@Body() b: ScoreDto) {
    return this.certs.score(b.items.map((i) => ({ ...i, grade: i.grade ?? null })));
  }

  @Get('config')
  config() {
    return this.certs.getConfig();
  }

  @Put('config/key')
  async setKey(@Body() b: CertKeyDto) {
    const v = await this.certs.setKey(b.key ?? null);
    // 새 키로 바로 수집 시작 (기다리지 않음)
    void this.batch.tick();
    return v;
  }

  /** 지금 수집 (버튼). 끝날 때까지 기다림 */
  @Post('run')
  async run(@Body() b: RunDto) {
    await this.batch.runNow(b.jobs);
    return this.certs.getConfig();
  }

  @Get('places/branches')
  branches() {
    return this.certs.branches();
  }

  @Get('places')
  places(@Query() q: CertPlaceDto) {
    return this.certs.places(q.brch);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.certs.one(id);
  }

  @Get(':id/about')
  about(@Param('id') id: string) {
    return this.certs.about(id);
  }
}
