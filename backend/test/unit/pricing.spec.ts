import { costUsd, defaultPrice } from '../../src/stats/pricing';

describe('pricing', () => {
  it('모델 계열별 기본 단가', () => {
    expect(defaultPrice('claude-opus-5-5')).toEqual({ input: 5, output: 25 });
    expect(defaultPrice('gemini-3.5-flash-lite').input).toBe(0.1);
    expect(defaultPrice('gpt-4o-mini-transcribe').input).toBe(1.25);
    expect(defaultPrice('unknown-model')).toEqual({ input: 1, output: 5 });
  });

  it('토큰·음성 비용 계산', () => {
    expect(costUsd({ input: 3, output: 15 }, 1_000_000, 100_000)).toBeCloseTo(4.5);
    expect(costUsd({ input: 0, output: 0 }, 0, 0, 120)).toBeCloseTo(0.012);
  });
});
