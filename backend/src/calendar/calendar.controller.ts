import { Controller, Get, UseFilters } from '@nestjs/common';
import { Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MailErrorFilter } from '../mail/mail.errors';
import { CalendarService } from './calendar.service';

export class UpcomingQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31)
  days: number = 7;
}

/** 읽기 전용 일정 API. 인증 없음: HOST=127.0.0.1 유지. */
@Controller('calendar')
@UseFilters(MailErrorFilter)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('today')
  today() {
    return this.calendar.today();
  }

  @Get('events')
  events(@Query() q: UpcomingQueryDto) {
    return this.calendar.upcoming(q.days);
  }
}
