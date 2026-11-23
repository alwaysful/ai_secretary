import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MAX_SHORTCUTS, Section, SECTIONS, ShortcutService } from './shortcut.service';

export class CreateShortcutDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  url!: string;

  /** 비우면 도메인 */
  @IsOptional() @IsString() @MaxLength(60)
  title?: string;

  /** lobby(기본) | tools */
  @IsOptional() @IsIn(SECTIONS)
  section?: Section;
}

export class UpdateShortcutDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(2000)
  url?: string;

  @IsOptional() @IsString() @MaxLength(60)
  title?: string;
}

export class ReorderShortcutsDto {
  @IsArray() @ArrayMaxSize(MAX_SHORTCUTS) @IsUUID('all', { each: true })
  ids!: string[];

  @IsOptional() @IsIn(SECTIONS)
  section?: Section;
}

export class ListShortcutsQuery {
  @IsOptional() @IsIn(SECTIONS)
  section?: Section;
}

/** 로비·도구 탭 웹사이트 바로가기 CRUD. 인증 없음: HOST=127.0.0.1 유지. */
@Controller('shortcuts')
export class ShortcutController {
  constructor(private readonly shortcuts: ShortcutService) {}

  @Get()
  list(@Query() q: ListShortcutsQuery) {
    return this.shortcuts.list(q.section);
  }

  @Post()
  create(@Body() dto: CreateShortcutDto) {
    return this.shortcuts.create(dto);
  }

  @Put('order')
  reorder(@Body() dto: ReorderShortcutsDto) {
    return this.shortcuts.reorder(dto.ids, dto.section);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShortcutDto) {
    return this.shortcuts.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.shortcuts.remove(id);
  }
}
