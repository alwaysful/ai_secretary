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

export interface ModelProbe {
  /** 모델 서버 접속 가능 여부 */
  reachable: boolean;
  /** 모델 설치 여부. 모르면 null */
  installed: boolean | null;
  /** 모델이 메모리에 올라가 있는지. 모르면 null */
  loaded: boolean | null;
}

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
  /** 로컬(Ollama) 모델 이름. API 사용 중이어도 로컬 모델 */
  get localName(): string {
    return this.name;
  }
  abstract get state(): ModelState;
  /** force: 상태가 ready여도 다시 적재 요청 (keep_alive 만료 대비) */
  abstract load(force?: boolean): Promise<void>;
  abstract generate(request: GenerateRequest): Promise<GenerateResponse>;
  abstract stream(request: GenerateRequest): AsyncIterable<string>;
  abstract unload(): Promise<void>;

  /** 설치된 모델 목록 */
  async listModels(): Promise<string[]> {
    return [this.name];
  }

  /** 사용할 모델 변경. 기존 모델은 메모리에서 내린다. */
  async switchTo(name: string): Promise<void> {
    if (name !== this.name) throw new ModelError('NOT_FOUND', `model switching not supported: ${name}`);
  }

  /** 상태 점검. 기본 구현은 알 수 없음. */
  async probe(): Promise<ModelProbe> {
    return { reachable: true, installed: null, loaded: null };
  }
}
