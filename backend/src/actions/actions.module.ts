import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { GoogleModule } from '../google/google.module';
import { MailModule } from '../mail/mail.module';
import { MemoryModule } from '../memory/memory.module';
import { ActionsController } from './actions.controller';
import { CalendarActionService } from './calendar-action.service';

@Module({
  imports: [CalendarModule, GoogleModule, MailModule, MemoryModule],
  controllers: [ActionsController],
  providers: [CalendarActionService],
  exports: [CalendarActionService],
})
export class ActionsModule {}
