import { aliasOf, gradeTokens, singleGradeIsPublic } from '../../src/cert/catalog';

describe('국가공인 등급', () => {
  it('범위 풀기·낱개 등급 공인 여부', () => {
    expect(gradeTokens(['1~3급'])).toEqual(['1급', '2급', '3급']);
    expect(singleGradeIsPublic('1급', ['2급'])).toBe(false);
    expect(singleGradeIsPublic('2급', ['1~3급'])).toBe(true);
    expect(singleGradeIsPublic('1~3급', ['1급'])).toBe(true);
    expect(singleGradeIsPublic(null, ['1급'])).toBe(true);
  });
  it('이름 다른 공인 종목 별칭', () => {
    expect(aliasOf('SQL')?.ids['it-sqld']).toBe('개발자');
    expect(aliasOf('전산세무회계')).toBeTruthy();
    expect(aliasOf('SQL 전문가')).toBeUndefined();
  });
});
