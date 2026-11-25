import { Module } from '@nestjs/common';
import { CertModule } from '../cert/cert.module';
import { LocalRemote } from './local-remote';
import { UserCertController } from './user-cert.controller';
import { UserCertService } from './user-cert.service';

/** 단독 실행 화면: 별표·고친 값·직접 추가·직접 일정 (이 서비스 DB) */
@Module({
  imports: [CertModule],
  controllers: [UserCertController],
  providers: [LocalRemote, UserCertService],
})
export class UserModule {}
