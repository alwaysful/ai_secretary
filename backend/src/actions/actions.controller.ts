import { Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { MailErrorFilter } from '../mail/mail.errors';
import { MemoryService } from '../memory/memory.service';
import { PcControlService } from '../pc-control/pc-control.service';
import { isLocalRequest } from '../system/system.controller';
import { CalendarActionService } from './calendar-action.service';

/** 확인 대기 작업 (일정·기억). 쓰기는 여기 confirm 으로만 실행된다. */
@Controller('actions')
@UseFilters(MailErrorFilter)
export class ActionsController {
  constructor(
    private readonly calendar: CalendarActionService,
    private readonly memory: MemoryService,
    private readonly pc: PcControlService,
  ) {}

  @Get()
  list(@Query('conversationId') conversationId?: string) {
    return [
      ...this.calendar.list(conversationId),
      ...this.memory.listPending(conversationId),
      ...this.pc.listPending(conversationId),
    ];
  }

  @Post(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    if (this.pc.has(id)) {
      if (!isLocalRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'])) {
        throw new ForbiddenException({ code: 'LOCAL_ONLY', message: 'PC 조작은 PC에서만 시작 가능' });
      }
      return this.pc.confirm(id);
    }
    return this.memory.has(id) ? this.memory.confirm(id) : this.calendar.confirm(id);
  }

  @Delete(':id')
  @HttpCode(204)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    if (this.pc.has(id)) this.pc.dismiss(id);
    else if (this.memory.has(id)) this.memory.cancel(id);
    else this.calendar.cancel(id);
  }
}
