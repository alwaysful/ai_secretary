import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class ScreenCheckDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(3_000_000)
  @Matches(/^[A-Za-z0-9+/=]+$/)
  image!: string;
}

export class ScreenCheckResponseDto {
  distracted!: boolean;

  activity!: string;

  distractPct!: number;

  summary!: string;

  message!: string | null;
}
