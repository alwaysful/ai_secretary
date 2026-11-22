import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { MailErrorFilter } from '../mail/mail.errors';
import { MemoryService } from '../memory/memory.service';
import { CalendarActionService } from './calendar-action.service';

/** 확인 대기 작업 (일정·기억). 쓰기는 여기 confirm 으로만 실행된다. */
@Controller('actions')
@UseFilters(MailErrorFilter)
export class ActionsController {
  constructor(
    private readonly calendar: CalendarActionService,
    private readonly memory: MemoryService,
  ) {}

  @Get()
  list(@Query('conversationId') conversationId?: string) {
    return [...this.calendar.list(conversationId), ...this.memory.listPending(conversationId)];
  }

  @Post(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.memory.has(id) ? this.memory.confirm(id) : this.calendar.confirm(id);
  }

  @Delete(':id')
  @HttpCode(204)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    if (this.memory.has(id)) this.memory.cancel(id);
    else this.calendar.cancel(id);
  }
}
