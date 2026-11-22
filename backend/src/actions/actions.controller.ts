import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { MailErrorFilter } from '../mail/mail.errors';
import { CalendarActionService } from './calendar-action.service';

/** 확인 대기 작업. 쓰기는 여기 confirm 으로만 실행된다. */
@Controller('actions')
@UseFilters(MailErrorFilter)
export class ActionsController {
  constructor(private readonly actions: CalendarActionService) {}

  @Get()
  list(@Query('conversationId') conversationId?: string) {
    return this.actions.list(conversationId);
  }

  @Post(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.actions.confirm(id);
  }

  @Delete(':id')
  @HttpCode(204)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    this.actions.cancel(id);
  }
}
