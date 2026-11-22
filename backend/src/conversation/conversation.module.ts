import { Module } from '@nestjs/common';
import { ModelsModule } from '../ai/models/models.module';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [ModelsModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
