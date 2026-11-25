import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { UserCertService as CertService } from './user-cert.service';

const bool = ({ value }: { value: unknown }) => value === 'true' || value === '1' || value === true;
const emptyNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

class CertQueryDto {
  @IsOptional() @IsString() @MaxLength(30)
  field?: string;

  @IsOptional() @IsString() @MaxLength(20)
  kind?: string;

  @IsOptional() @Transform(bool) @IsBoolean()
  starred?: boolean;

  @IsOptional() @IsString() @MaxLength(100)
  q?: string;
}

class CertCalendarDto extends CertQueryDto {
  @Type(() => Date) @IsDate()
  from!: Date;

  @Type(() => Date) @IsDate()
  to!: Date;
}

class CertUpdateDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80)
  name?: string;

  @IsOptional() @IsString() @MaxLength(30)
  field?: string;

  @IsOptional() @IsString() @MaxLength(20)
  kind?: string;

  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(30)
  grade?: string | null;

  @IsOptional() @IsString() @MaxLength(60)
  org?: string;

  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsUrl({ require_tld: false }) @MaxLength(500)
  url?: string | null;

  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300)
  summary?: string | null;

  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60)
  prep?: string | null;

  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(80)
  fee?: string | null;

  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60)
  validity?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(10)
  score?: number | null;

  @IsOptional() @IsBoolean()
  starred?: boolean;
}

const optDate = () => (target: object, key: string) => {
  Transform(({ value }) => (value === '' || value === null || value === undefined ? null : new Date(value as string)))(target, key);
  ValidateIf((_, v) => v !== null)(target, key);
  IsDate()(target, key);
  IsOptional()(target, key);
};

class ExamDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  title!: string;

  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(20)
  phase?: string | null;

  @optDate() regStart?: Date | null;
  @optDate() regEnd?: Date | null;
  @optDate() examStart?: Date | null;
  @optDate() examEnd?: Date | null;
  @optDate() resultAt?: Date | null;

  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300)
  note?: string | null;
}

class CertPlaceDto {
  @IsString() @Matches(/^\d{2}$/)
  brch!: string;
}

class CertKeyDto {
  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300)
  key?: string | null;
}

/** 단독 실행 화면 API (/app/certs). AURA 화면 API와 같은 모양 */
@Controller('app/certs')
export class UserCertController {
  constructor(private readonly certs: CertService) {}

  @Get()
  list(@Query() q: CertQueryDto) {
    return this.certs.list(q);
  }

  @Get('meta')
  meta() {
    return this.certs.meta();
  }

  @Get('fields')
  fields(@Query() q: CertQueryDto) {
    return this.certs.fieldCounts({ kind: q.kind, starred: q.starred, q: q.q });
  }

  @Get('calendar')
  calendar(@Query() q: CertCalendarDto) {
    return this.certs.calendar(q);
  }

  @Get('config')
  config() {
    return this.certs.getConfig();
  }

  @Put('config/key')
  setKey(@Body() b: CertKeyDto) {
    return this.certs.setKey(b.key ?? null);
  }

  /** 시험장소 지역 목록 */
  @Get('places/branches')
  branches() {
    return this.certs.branches();
  }

  /** 시험장소 (지역 코드 01~24) */
  @Get('places')
  places(@Query() q: CertPlaceDto) {
    return this.certs.places(q.brch);
  }

  @Post('discover')
  discover() {
    return this.certs.discover();
  }

  @Post('sync')
  sync() {
    return this.certs.sync();
  }

  /** 지금 전부 수집 (취득자·공개문제·시험장소·등록정보 포함) */
  @Post('collect')
  collect() {
    return this.certs.collect();
  }

  @Post()
  create(@Body() b: CertUpdateDto) {
    if (!b.name?.trim()) throw new BadRequestException('이름 필요');
    return this.certs.create({ ...b, name: b.name });
  }

  @Delete('exams/:id')
  @HttpCode(204)
  removeExam(@Param('id', ParseUUIDPipe) id: string) {
    return this.certs.removeExam(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() b: CertUpdateDto) {
    return this.certs.update(id, b);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.certs.remove(id);
  }

  /** 「설명」 자료: 설명·취득자·합격률·공개문제·민간 등록정보 (자격증 서비스 DB 값) */
  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.certs.stats(id);
  }

  @Post(':id/exams')
  addExam(@Param('id') id: string, @Body() b: ExamDto) {
    return this.certs.addExam(id, b);
  }
}
