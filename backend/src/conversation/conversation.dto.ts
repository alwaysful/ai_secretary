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

export class UpdateConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
}

export class ListConversationsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
