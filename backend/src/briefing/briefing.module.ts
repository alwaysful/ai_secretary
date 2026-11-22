import { Module } from '@nestjs/common';
import { ModelsModule } from '../ai/models/models.module';
import { CalendarModule } from '../calendar/calendar.module';
import { MailModule } from '../mail/mail.module';
import { SettingsModule } from '../settings/settings.module';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';

@Module({
  imports: [ModelsModule, CalendarModule, MailModule, SettingsModule],
  controllers: [BriefingController],
  providers: [BriefingService],
})
export class BriefingModule {}
