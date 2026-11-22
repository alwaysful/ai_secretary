import { Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { MailModule } from '../mail/mail.module';
import { CalendarHub } from './calendar-hub.service';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [MailModule, GoogleModule],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarHub],
  exports: [CalendarService, CalendarHub],
})
export class CalendarModule {}
