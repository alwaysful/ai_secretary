import { Module } from '@nestjs/common';
import { ModelsModule } from '../ai/models/models.module';
import { ToolsModule } from '../ai/tools/tools.module';
import { ActionsModule } from '../actions/actions.module';
import { SettingsModule } from '../settings/settings.module';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [ModelsModule, ToolsModule, SettingsModule, ActionsModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
