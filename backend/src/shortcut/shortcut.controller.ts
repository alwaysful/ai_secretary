import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MAX_SHORTCUTS, ShortcutService } from './shortcut.service';

export class CreateShortcutDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  url!: string;

  /** 비우면 도메인 */
  @IsOptional() @IsString() @MaxLength(60)
  title?: string;
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
}

/** 로비 웹사이트 바로가기 CRUD. 인증 없음: HOST=127.0.0.1 유지. */
@Controller('shortcuts')
export class ShortcutController {
  constructor(private readonly shortcuts: ShortcutService) {}

  @Get()
  list() {
    return this.shortcuts.list();
  }

  @Post()
  create(@Body() dto: CreateShortcutDto) {
    return this.shortcuts.create(dto);
  }

  @Put('order')
  reorder(@Body() dto: ReorderShortcutsDto) {
    return this.shortcuts.reorder(dto.ids);
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
