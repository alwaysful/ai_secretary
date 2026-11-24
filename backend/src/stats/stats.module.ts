import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { UsageService } from './usage.service';
import { BudgetService } from './budget.service';

@Module({
  imports: [CalendarModule],
  controllers: [StatsController],
  providers: [StatsService, UsageService, BudgetService],
  exports: [BudgetService],
})
export class StatsModule {}
