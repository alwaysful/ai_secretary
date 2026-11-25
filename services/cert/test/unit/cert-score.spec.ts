import { CATALOG } from '../../src/cert/catalog';
import { scoreOf } from '../../src/cert/score';

describe('유용도 참고값', () => {
  it('이름별 값 우선, 없으면 등급·분야로 0~10 소수 한 자리', () => {
    expect(scoreOf({ name: '정보처리기사', kind: '국가기술', grade: '기사', field: '정보통신/IT' })).toBe(9);
    expect(scoreOf({ name: '컴퓨터활용능력 1급', kind: '국가기술', grade: '1급', field: '경영/사무/OA' })).toBe(7.4);
    const s = scoreOf({ name: '없는기사', kind: '국가기술', grade: '기사', field: '전기/전자' });
    expect(s).toBe(7.5);
    for (const c of CATALOG) {
      const v = scoreOf(c);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
      expect(Math.round(v * 10) / 10).toBe(v);
    }
  });
});
