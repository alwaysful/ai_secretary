import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListMessagesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  top: number = 10;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unreadOnly: boolean = false;
}
