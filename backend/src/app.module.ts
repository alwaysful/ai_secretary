import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModelsModule } from './ai/models/models.module';
import { ActionsModule } from './actions/actions.module';
import { BriefingModule } from './briefing/briefing.module';
import { CalendarModule } from './calendar/calendar.module';
import { MemoryModule } from './memory/memory.module';
import { StudyModule } from './study/study.module';
import { ShortcutModule } from './shortcut/shortcut.module';
import { SettingsModule } from './settings/settings.module';
import { validateEnv } from './config/env';
import { ConversationModule } from './conversation/conversation.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    ModelsModule,
    ConversationModule,
    CalendarModule,
    SettingsModule,
    ActionsModule,
    BriefingModule,
    MemoryModule,
    StudyModule,
    ShortcutModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
