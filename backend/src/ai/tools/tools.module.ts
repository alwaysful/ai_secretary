import { Module } from '@nestjs/common';
import { CalendarModule } from '../../calendar/calendar.module';
import { MailModule } from '../../mail/mail.module';
import { CalendarTool } from './calendar.tool';
import { MailTool } from './mail.tool';
import { ToolRegistry } from './tool-registry.service';
import { ToolContextProvider } from './tool';

@Module({
  imports: [MailModule, CalendarModule],
  providers: [MailTool, CalendarTool, ToolRegistry, { provide: ToolContextProvider, useExisting: ToolRegistry }],
  exports: [ToolContextProvider],
})
export class ToolsModule {}
