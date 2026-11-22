import { Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { ModelsModule } from '../ai/models/models.module';
import { CalendarModule } from '../calendar/calendar.module';
import { MailModule } from '../mail/mail.module';
import { MemoryModule } from '../memory/memory.module';
import { SettingsModule } from '../settings/settings.module';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';

@Module({
  imports: [ModelsModule, CalendarModule, GoogleModule, MailModule, SettingsModule, MemoryModule],
  controllers: [BriefingController],
  providers: [BriefingService],
})
export class BriefingModule {}
