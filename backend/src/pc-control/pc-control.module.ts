import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { PcControlController } from './pc-control.controller';
import { PcControlService } from './pc-control.service';

@Module({
  imports: [SettingsModule],
  controllers: [PcControlController],
  providers: [PcControlService],
  exports: [PcControlService],
})
export class PcControlModule {}
