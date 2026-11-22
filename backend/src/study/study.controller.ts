import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ScreenCheckDto, ScreenCheckResponseDto } from './dto/screen-check.dto';
import { StudyService } from './study.service';

/** 로컬 단일 사용자. 쿨다운 키 고정. */
@Controller('study')
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Post('screen-check')
  @HttpCode(200)
  screenCheck(@Body() body: ScreenCheckDto): Promise<ScreenCheckResponseDto> {
    return this.study.check('local', body.image);
  }
}
