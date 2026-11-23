import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const PERSONAS = ['girlfriend'] as const;
export type Persona = (typeof PERSONAS)[number];

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /** 없으면 일반 채팅 */
  @IsOptional()
  @IsIn([...PERSONAS])
  persona?: Persona;
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

  @IsOptional()
  @IsIn([...PERSONAS])
  persona?: Persona;
}
