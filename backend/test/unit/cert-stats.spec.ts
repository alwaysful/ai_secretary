import { parseCertStats, qnetStatUrl } from '../../src/cert/qnet';

const xml = (rows: number[][]) =>
  `<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>${rows
    .map((r, i) => `<item><jmnm>정보처리기사</jmnm><sexnm>${i ? '여자' : '남자'}</sexnm>${r.map((v, k) => `<ilpcnt${k + 1}>${v}</ilpcnt${k + 1}>`).join('')}</item>`)
    .join('')}</items></body></response>`;

describe('취득자 통계', () => {
  it('남녀 합산, ilpcnt1 = 이전 누적, ilpcnt2~6 = 4년 전~기준년도', () => {
    const s = parseCertStats(xml([[393364, 9835, 6674, 7621, 12493, 10798], [238528, 6488, 4437, 4584, 7388, 5528]]), 2025);
    expect(s?.years.map((y) => y.year)).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(s?.years[4].count).toBe(16326);
    expect(s?.total).toBe(440785 + 266953);
  });
  it('빈 응답은 null', () => {
    expect(parseCertStats(xml([]), 2025)).toBeNull();
  });
  it('URL', () => {
    expect(qnetStatUrl('a+b', 2025, '1320')).toContain('baseYY=2025&jmCd=1320');
  });
});
