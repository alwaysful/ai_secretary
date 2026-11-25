import { acqGrade, acqRate, sameOrg, shortOrg } from '../src/cert/catalog-acq';
import { ACQ_BY_ID, CATALOG } from '../src/cert/catalog';

const norm = (s: string) => s.replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase();

describe('민간자격취득현황 목록', () => {
  it('등급 칸 정리', () => {
    expect(acqGrade(['1급', '2급', '3급', '전문가급'])).toBe('1~3급·전문가급');
    expect(acqGrade(['10급', '1급', '2급', '11급', '12급', 'BP급'])).toBe('1~2급·10~12급·BP급');
    expect(acqGrade(['등급없음'])).toBeNull();
  });

  it('기관 이름 비교', () => {
    expect(shortOrg('사단법인한국커피협회')).toBe('한국커피협회');
    expect(sameOrg('금융투자협회', '한국금융투자협회')).toBe(true);
    expect(sameOrg('여러 협회', '한국커피협회')).toBe(false);
  });

  it('합격률: 입력 오류는 표시 안 함', () => {
    expect(acqRate({ applicants: 200, acquired: 100 })).toBe('50%');
    expect(acqRate({ applicants: 100, acquired: 300 })).toBeNull();
    expect(acqRate({ applicants: 5_000_000, acquired: 10, suspect: true })).toBeNull();
  });

  it('id·이름 중복 없음, 기존 행엔 통계만 붙임', () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
    expect(new Set(CATALOG.map((c) => norm(c.name))).size).toBe(CATALOG.length);
    const pa = CATALOG.filter((c) => c.id.startsWith('pa-'));
    expect(pa.length).toBeGreaterThan(400);
    expect(pa.every((c) => c.kind === '민간' && c.statsYears?.length)).toBe(true);
    expect(ACQ_BY_ID.has('fn-invest')).toBe(true);
    expect(CATALOG.find((c) => c.id === 'fn-invest')?.statsTotal).toBeGreaterThan(1000);
  });
});
