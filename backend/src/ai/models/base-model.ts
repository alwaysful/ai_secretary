export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** 호출자 취소 신호 */
  signal?: AbortSignal;
  /** 요청별 타임아웃(ms). 미지정 시 모델 기본값 */
  timeoutMs?: number;
}

export interface GenerateResponse {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs: number;
}

export type ModelState = 'unloaded' | 'loading' | 'ready' | 'error';

export type ModelErrorCode = 'UNAVAILABLE' | 'NOT_FOUND' | 'TIMEOUT' | 'ABORTED' | 'BAD_RESPONSE';

export class ModelError extends Error {
  constructor(
    public readonly code: ModelErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ModelError';
  }
}

/**
 * 모든 모델 공급자의 공통 인터페이스.
 * abstract class라서 NestJS DI 토큰으로도 사용한다.
 */
export abstract class BaseModel {
  abstract readonly name: string;
  abstract get state(): ModelState;
  abstract load(): Promise<void>;
  abstract generate(request: GenerateRequest): Promise<GenerateResponse>;
  abstract stream(request: GenerateRequest): AsyncIterable<string>;
  abstract unload(): Promise<void>;
}
