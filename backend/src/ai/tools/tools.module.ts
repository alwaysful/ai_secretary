import { Module } from '@nestjs/common';
import { CalendarModule } from '../../calendar/calendar.module';
import { GoogleModule } from '../../google/google.module';
import { MailModule } from '../../mail/mail.module';
import { CalendarTool } from './calendar.tool';
import { MailTool } from './mail.tool';
import { TasksTool } from './tasks.tool';
import { ToolRegistry } from './tool-registry.service';
import { ToolContextProvider } from './tool';

@Module({
  imports: [MailModule, CalendarModule, GoogleModule],
  providers: [MailTool, CalendarTool, TasksTool, ToolRegistry, { provide: ToolContextProvider, useExisting: ToolRegistry }],
  exports: [ToolContextProvider],
})
export class ToolsModule {}
