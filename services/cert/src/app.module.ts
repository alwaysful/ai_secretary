import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CertModule } from './cert/cert.module';
import { PrismaModule } from './prisma.service';
import { UserModule } from './user/user.module';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { ok: true, service: 'cert' };
  }
}

@Module({
  // 설정은 이 폴더 .env 만 (AURA와 독립)
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }), PrismaModule, CertModule, UserModule],
  controllers: [HealthController],
})
export class AppModule {}
