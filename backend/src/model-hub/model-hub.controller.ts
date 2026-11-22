import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ModelHubService } from './model-hub.service';

export class PullDto {
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;
}

@Controller('model-hub')
export class ModelHubController {
  constructor(private readonly hub: ModelHubService) {}

  /** 추천 모델 + 설치 여부 + 다운로드 진행 */
  @Get()
  view() {
    return this.hub.view();
  }

  @Get('jobs')
  jobs() {
    return this.hub.listJobs();
  }

  @Post('pull')
  @HttpCode(202)
  pull(@Body() dto: PullDto) {
    return this.hub.pull(dto.name);
  }

  @Delete('pull/:name')
  @HttpCode(204)
  cancel(@Param('name') name: string) {
    this.hub.cancel(name);
  }

  @Delete('models/:name')
  @HttpCode(204)
  remove(@Param('name') name: string) {
    return this.hub.remove(name);
  }
}
