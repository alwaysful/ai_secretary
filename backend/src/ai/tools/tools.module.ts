import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { MailTool } from './mail.tool';
import { ToolRegistry } from './tool-registry.service';
import { ToolContextProvider } from './tool';

@Module({
  imports: [MailModule],
  providers: [MailTool, ToolRegistry, { provide: ToolContextProvider, useExisting: ToolRegistry }],
  exports: [ToolContextProvider],
})
export class ToolsModule {}
