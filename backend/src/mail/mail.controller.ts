import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  PipeTransform,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { ListMessagesQueryDto } from './mail.dto';
import { MailErrorFilter } from './mail.errors';
import { MailAuthService } from './mail-auth.service';
import { MailService } from './mail.service';

@Injectable()
class MessageIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[A-Za-z0-9_=-]{8,512}$/.test(value)) throw new BadRequestException('invalid message id');
    return value;
  }
}

/** 읽기 전용 Outlook API. 인증 없음: HOST=127.0.0.1 유지. */
@Controller('mail')
@UseFilters(MailErrorFilter)
export class MailController {
  constructor(
    private readonly auth: MailAuthService,
    private readonly mail: MailService,
  ) {}

  @Get('unread-count')
  async unreadCount() {
    return { count: await this.mail.unreadCount() };
  }

  @Get('auth/status')
  status() {
    return this.auth.status();
  }

  @Post('auth/start')
  start() {
    return this.auth.startDeviceLogin();
  }

  @Delete('auth')
  @HttpCode(204)
  async disconnect(): Promise<void> {
    await this.auth.disconnect();
  }

  @Get('messages')
  list(@Query() q: ListMessagesQueryDto) {
    return this.mail.list({ top: q.top, unreadOnly: q.unreadOnly });
  }

  @Get('messages/:id')
  get(@Param('id', MessageIdPipe) id: string) {
    return this.mail.get(id);
  }
}
