import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModelsModule } from './ai/models/models.module';
import { ActionsModule } from './actions/actions.module';
import { BriefingModule } from './briefing/briefing.module';
import { CalendarModule } from './calendar/calendar.module';
import { ModelHubModule } from './model-hub/model-hub.module';
import { MemoryModule } from './memory/memory.module';
import { StudyModule } from './study/study.module';
import { ShortcutModule } from './shortcut/shortcut.module';
import { ScrapeModule } from './scrape/scrape.module';
import { SystemModule } from './system/system.module';
import { SetupModule } from './setup/setup.module';
import { PcControlModule } from './pc-control/pc-control.module';
import { ToolsModule } from './tools/tools.module';
import { StatsModule } from './stats/stats.module';
import { SettingsModule } from './settings/settings.module';
import { validateEnv } from './config/env';
import { ConversationModule } from './conversation/conversation.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';

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
    ScrapeModule,
    SystemModule,
    SetupModule,
    ModelHubModule,
    PcControlModule,
    ToolsModule,
    StatsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
