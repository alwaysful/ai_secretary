import { Module } from '@nestjs/common';
import { ModelsModule } from '../ai/models/models.module';
import { ModelHubController } from './model-hub.controller';
import { ModelHubService } from './model-hub.service';

@Module({
  imports: [ModelsModule],
  controllers: [ModelHubController],
  providers: [ModelHubService],
})
export class ModelHubModule {}
