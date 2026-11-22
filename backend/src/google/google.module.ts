import { Module } from '@nestjs/common';
import { GoogleApi } from './google-api.service';
import { GoogleAuthService } from './google-auth.service';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleController } from './google.controller';
import { GoogleTasksService } from './google-tasks.service';

@Module({
  controllers: [GoogleController],
  providers: [GoogleAuthService, GoogleApi, GoogleCalendarService, GoogleTasksService],
  exports: [GoogleAuthService, GoogleCalendarService, GoogleTasksService],
})
export class GoogleModule {}
