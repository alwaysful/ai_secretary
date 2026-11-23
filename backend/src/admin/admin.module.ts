import { Module } from '@nestjs/common';
import { ModelsModule } from '../ai/models/models.module';
import { ScrapeModule } from '../scrape/scrape.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [ModelsModule, SettingsModule, ScrapeModule],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminService, AdminGuard],
})
export class AdminModule {}
