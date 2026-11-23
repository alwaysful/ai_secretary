import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { StudyController } from './study.controller';
import { PhoneService } from './phone.service';
import { StudyStatsService } from './study-stats.service';
import { StudyService } from './study.service';

@Module({
  imports: [SettingsModule],
  controllers: [StudyController],
  providers: [StudyService, StudyStatsService, PhoneService],
})
export class StudyModule {}
