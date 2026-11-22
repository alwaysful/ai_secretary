import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MemoryService } from './memory.service';

export class CreateMemoryDto {
  @IsString() @IsNotEmpty() @MaxLength(1000)
  content!: string;

  @IsOptional() @IsString() @MaxLength(50)
  category?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class UpdateMemoryDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(1000)
  content?: string;

  @IsOptional() @IsString() @MaxLength(50)
  category?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

/** 장기 기억 CRUD. 인증 없음: HOST=127.0.0.1 유지. */
@Controller('memories')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.memory.list(q);
  }

  @Post()
  create(@Body() dto: CreateMemoryDto) {
    return this.memory.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMemoryDto) {
    return this.memory.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.memory.remove(id);
  }

  /** 전체 삭제. 실수 방지로 ?confirm=all 필요 */
  @Delete()
  async removeAll(@Query('confirm') confirm?: string) {
    if (confirm !== 'all') throw new BadRequestException('confirm=all required');
    return { deleted: await this.memory.removeAll() };
  }
}
