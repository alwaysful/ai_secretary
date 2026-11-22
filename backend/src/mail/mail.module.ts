import { Module } from '@nestjs/common';
import { MailAuthService } from './mail-auth.service';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  controllers: [MailController],
  providers: [MailAuthService, MailService],
  exports: [MailAuthService, MailService],
})
export class MailModule {}
