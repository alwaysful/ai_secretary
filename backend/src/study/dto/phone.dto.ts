import { IsBoolean, IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Android 앱 → 딴짓 앱 사용 1회 */
export class PhoneEventDto {
  @IsString() @MaxLength(200) @Matches(/^[\w.]+$/)
  package!: string;

  @IsString() @MaxLength(100)
  label!: string;
}

export class PhoneEventsQueryDto {
  @IsOptional() @IsDateString()
  since?: string;
}

export class LiveDto {
  @IsBoolean()
  active!: boolean;
}
