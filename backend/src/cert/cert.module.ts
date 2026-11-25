import { Module } from '@nestjs/common';
import { CertClient } from './cert.client';
import { CertController } from './cert.controller';
import { CertService } from './cert.service';

/** 자격증 탭: 정보는 자격증 서비스, 사용자 값(별표·수정·직접 추가·직접 일정)은 AURA DB */
@Module({
  controllers: [CertController],
  providers: [CertClient, CertService],
})
export class CertModule {}
