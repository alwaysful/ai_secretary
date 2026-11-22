import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Max, Min, validateSync } from 'class-validator';

export class EnvVars {
  @Type(() => Number) @IsInt() @Min(1) @Max(65535)
  PORT: number = 3000;

  @IsString()
  HOST: string = '127.0.0.1';

  @IsString()
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false })
  OLLAMA_BASE_URL: string = 'http://127.0.0.1:11434';

  @IsString()
  OLLAMA_MODEL: string = 'qwen3:4b';

  @IsString()
  OLLAMA_KEEP_ALIVE: string = '5m';

  @Type(() => Number) @IsInt() @Min(1000)
  MODEL_TIMEOUT_MS: number = 120_000;

  @Type(() => Number) @IsInt() @Min(1) @Max(200)
  HISTORY_LIMIT: number = 20;

  @IsOptional() @IsString()
  SYSTEM_PROMPT: string = '너는 AURA, 사용자의 로컬 개인 비서다. 간결하고 정확하게 한국어로 답한다.';
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const env = plainToInstance(EnvVars, raw);
  const errors = validateSync(env);
  if (errors.length > 0) {
    const msg = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Invalid environment: ${msg}`);
  }
  return env;
}
