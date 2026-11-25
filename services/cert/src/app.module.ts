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
  // 자기 .env 먼저, 없는 값은 AURA backend/.env (QNET_API_KEY, 옛 DB 주소)
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../backend/.env'] }), PrismaModule, CertModule, UserModule],
  controllers: [HealthController],
})
export class AppModule {}
