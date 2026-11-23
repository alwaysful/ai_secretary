import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { MailModule } from '../mail/mail.module';
import { MemoryModule } from '../memory/memory.module';
import { PcControlModule } from '../pc-control/pc-control.module';
import { ActionsController } from './actions.controller';
import { CalendarActionService } from './calendar-action.service';

@Module({
  imports: [CalendarModule, MailModule, MemoryModule, PcControlModule],
  controllers: [ActionsController],
  providers: [CalendarActionService],
  exports: [CalendarActionService],
})
export class ActionsModule {}
