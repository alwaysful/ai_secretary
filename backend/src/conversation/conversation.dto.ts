import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;
}
