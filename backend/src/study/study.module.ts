import { Module } from '@nestjs/common';
import { StudyController } from './study.controller';
import { PhoneService } from './phone.service';
import { StudyStatsService } from './study-stats.service';
import { StudyService } from './study.service';

@Module({
  controllers: [StudyController],
  providers: [StudyService, StudyStatsService, PhoneService],
})
export class StudyModule {}
