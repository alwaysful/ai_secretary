import { Module } from '@nestjs/common';
import { ModelsModule } from '../ai/models/models.module';
import { ScrapeModule } from '../scrape/scrape.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminAuthService } from './admin-auth.service';
import { AdminController, Live2dController } from './admin.controller';
import { CompanionService } from './companion.service';
import { UpdateService } from './update.service';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [ModelsModule, SettingsModule, ScrapeModule],
  controllers: [AdminController, Live2dController],
  providers: [AdminAuthService, AdminService, AdminGuard, CompanionService, UpdateService],
  exports: [AdminAuthService, AdminGuard, CompanionService],
})
export class AdminModule {}
