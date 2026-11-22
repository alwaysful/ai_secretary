import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Matches, Max, Min, validateSync } from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

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

  /** 공부 집중: 화면 분석용 비전 모델 */
  @IsString()
  STUDY_VISION_MODEL: string = 'gemma4:12b';

  @IsString()
  OLLAMA_KEEP_ALIVE: string = '5m';

  @Type(() => Number) @IsInt() @Min(1000)
  MODEL_TIMEOUT_MS: number = 120_000;

  @Type(() => Number) @IsInt() @Min(1) @Max(200)
  HISTORY_LIMIT: number = 20;

  @IsOptional() @IsString()
  SYSTEM_PROMPT: string = '너는 AURA, 사용자의 로컬 개인 비서다. 간결하고 정확하게 한국어로 답한다.';

  /** 시각 표시 기준 시간대 (IANA) */
  @IsString()
  TIMEZONE: string = 'Asia/Seoul';

  /** Outlook(Microsoft Graph) 연동. 비우면 메일 기능 비활성. */
  @Transform(emptyToUndefined) @IsOptional() @IsString()
  MS_CLIENT_ID?: string;

  @IsString()
  MS_TENANT_ID: string = 'common';

  /** 리프레시 토큰 암호화 키. 64자리 hex(32바이트). */
  @Transform(emptyToUndefined) @IsOptional() @Matches(/^[0-9a-fA-F]{64}$/, { message: 'must be 64 hex chars' })
  TOKEN_ENC_KEY?: string;

  @Type(() => Number) @IsInt() @Min(200) @Max(20_000)
  MAIL_BODY_MAX_CHARS: number = 4000;

  /** Google 캘린더·Tasks 연동 (OAuth 데스크톱 클라이언트). 비우면 비활성. */
  @Transform(emptyToUndefined) @IsOptional() @IsString()
  GOOGLE_CLIENT_ID?: string;

  @Transform(emptyToUndefined) @IsOptional() @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  /** 기본: http://127.0.0.1:{PORT}/google/auth/callback */
  @Transform(emptyToUndefined) @IsOptional() @IsUrl({ require_tld: false, require_protocol: true })
  GOOGLE_REDIRECT_URI?: string;

  /** 대화 중 메일 요청 시 기본으로 읽을 메일 수 */
  @Type(() => Number) @IsInt() @Min(1) @Max(10)
  MAIL_CONTEXT_COUNT: number = 5;
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
  if (env.MS_CLIENT_ID && !env.TOKEN_ENC_KEY) {
    throw new Error('Invalid environment: TOKEN_ENC_KEY is required when MS_CLIENT_ID is set');
  }
  if (env.GOOGLE_CLIENT_ID && (!env.GOOGLE_CLIENT_SECRET || !env.TOKEN_ENC_KEY)) {
    throw new Error('Invalid environment: GOOGLE_CLIENT_SECRET and TOKEN_ENC_KEY are required when GOOGLE_CLIENT_ID is set');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: env.TIMEZONE });
  } catch {
    throw new Error(`Invalid environment: TIMEZONE: unknown time zone ${env.TIMEZONE}`);
  }
  return env;
}
