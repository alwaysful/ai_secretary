import { Module } from '@nestjs/common';
import { CertApi } from './cert.api';
import { CertBatch } from './cert.batch';
import { CertController } from './cert.controller';
import { CertService } from './cert.service';

@Module({
  controllers: [CertController],
  providers: [CertApi, CertBatch, CertService],
})
export class CertModule {}
