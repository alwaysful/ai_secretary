/** message는 모델 프롬프트에 그대로 들어간다. 토큰·외부 데이터를 담지 않는다. */
export class ToolError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ToolError';
  }
}

/**
 * 프롬프트에 컨텍스트를 주입하는 읽기 전용 도구.
 * readOnly: true 리터럴로 쓰기 도구의 등록을 타입 수준에서 막는다.
 * 쓰기·삭제·전송 도구는 승인 계층(Phase 4) 없이 추가하지 않는다.
 */
export interface ContextTool {
  readonly name: string;
  readonly readOnly: true;
  matches(text: string): boolean;
  run(text: string, signal?: AbortSignal): Promise<string>;
}

/** ConversationService가 의존하는 DI 토큰. */
export abstract class ToolContextProvider {
  abstract contextFor(text: string, signal?: AbortSignal): Promise<string | null>;
}
