import { Module } from '@nestjs/common';
import { StudyController } from './study.controller';
import { StudyStatsService } from './study-stats.service';
import { StudyService } from './study.service';

@Module({
  controllers: [StudyController],
  providers: [StudyService, StudyStatsService],
})
export class StudyModule {}
