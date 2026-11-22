import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const MAX_COUNT = 100_000;

/** 공부 세션 저장 (같은 id로 반복 전송 시 덮어씀) */
export class StudySessionDto {
  @IsUUID()
  id!: string;

  @IsDateString()
  startedAt!: string;

  @IsDateString()
  endedAt!: string;

  @IsInt() @Min(0) @Max(86_400)
  focusSec!: number;

  @IsInt() @Min(0) @Max(1_000)
  pomodoros!: number;

  @IsInt() @Min(0) @Max(MAX_COUNT)
  posture!: number;

  @IsInt() @Min(0) @Max(MAX_COUNT)
  phone!: number;

  @IsInt() @Min(0) @Max(MAX_COUNT)
  slack!: number;

  @IsInt() @Min(0) @Max(MAX_COUNT)
  sleep!: number;
}

export class StatsQueryDto {
  @IsOptional() @IsIn(['day', 'week'])
  unit?: 'day' | 'week';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(52)
  count?: number;
}

export interface StatsBucket {
  /** 버킷 시작 날짜 YYYY-MM-DD (주 단위는 월요일) */
  date: string;
  focusSec: number;
  pomodoros: number;
  posture: number;
  phone: number;
  slack: number;
  sleep: number;
}
