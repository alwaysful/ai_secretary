import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModelsModule } from './ai/models/models.module';
import { CalendarModule } from './calendar/calendar.module';
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
