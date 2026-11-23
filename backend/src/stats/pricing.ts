/** 기본 단가 (USD / 100만 토큰). 추정치. 통계 탭에서 모델별로 수정 가능 */
export interface Price {
  input: number;
  output: number;
}

const RULES: [RegExp, Price][] = [
  // Anthropic
  [/claude-.*opus/i, { input: 5, output: 25 }],
  [/claude-.*sonnet/i, { input: 3, output: 15 }],
  [/claude-.*haiku/i, { input: 1, output: 5 }],
  [/claude-.*fable/i, { input: 3, output: 15 }],
  [/^claude-/i, { input: 3, output: 15 }],
  // Gemini
  [/gemini.*flash-lite/i, { input: 0.1, output: 0.4 }],
  [/gemini.*transcribe/i, { input: 1, output: 2.5 }],
  [/gemini.*flash/i, { input: 0.3, output: 2.5 }],
  [/gemini.*(pro|argon)/i, { input: 1.25, output: 10 }],
  [/^gemini/i, { input: 0.3, output: 2.5 }],
  // OpenAI
  [/mini-transcribe/i, { input: 1.25, output: 5 }],
  [/transcribe/i, { input: 2.5, output: 10 }],
  [/(mini|nano|luna)/i, { input: 0.25, output: 2 }],
  [/^(gpt-|o\d|chatgpt)/i, { input: 1.25, output: 10 }],
];

const FALLBACK: Price = { input: 1, output: 5 };

/** whisper-1: 분당 과금 */
export const WHISPER_PER_MIN = 0.006;

export function defaultPrice(model: string): Price {
  return RULES.find(([re]) => re.test(model))?.[1] ?? FALLBACK;
}

export function costUsd(p: Price, inputTokens: number, outputTokens: number, audioSec = 0): number {
  return (inputTokens * p.input + outputTokens * p.output) / 1e6 + (audioSec / 60) * WHISPER_PER_MIN;
}
