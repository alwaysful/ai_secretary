import { Module } from '@nestjs/common';
import { ModelsModule } from '../ai/models/models.module';
import { ToolsModule } from '../ai/tools/tools.module';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [ModelsModule, ToolsModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
