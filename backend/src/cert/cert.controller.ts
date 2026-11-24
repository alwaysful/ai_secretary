import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { CertService } from './cert.service';

const bool = ({ value }: { value: unknown }) => value === 'true' || value === '1' || value === true;
const emptyNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

export class CertQueryDto {
  @IsOptional() @IsString() @MaxLength(30)
  field?: string;

  @IsOptional() @IsString() @MaxLength(20)
  kind?: string;

  @IsOptional() @Transform(bool) @IsBoolean()
  starred?: boolean;

  @IsOptional() @IsString() @MaxLength(100)
  q?: string;
}

export class CertCalendarDto extends CertQueryDto {
  @Type(() => Date) @IsDate()
  from!: Date;

  @Type(() => Date) @IsDate()
  to!: Date;
}

export class CertUpdateDto {
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

  @IsOptional() @IsBoolean()
  starred?: boolean;
}

const optDate = () => (target: object, key: string) => {
  Transform(({ value }) => (value === '' || value === null || value === undefined ? null : new Date(value as string)))(target, key);
  ValidateIf((_, v) => v !== null)(target, key);
  IsDate()(target, key);
  IsOptional()(target, key);
};

export class ExamDto {
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

export class CertKeyDto {
  @IsOptional() @Transform(emptyNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300)
  key?: string | null;
}

@Controller('certs')
export class CertController {
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

  @Post('discover')
  discover() {
    return this.certs.discover();
  }

  @Post('sync')
  sync() {
    return this.certs.sync();
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

  @Post(':id/exams')
  addExam(@Param('id') id: string, @Body() b: ExamDto) {
    return this.certs.addExam(id, b);
  }
}
