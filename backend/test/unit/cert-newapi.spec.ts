import { examAreaUrl, kregUrl, openQstUrl, parseExamArea, parseKReg, parseOpenQst, parsePassYears, passShort, passText, qnetPassUrl } from '../../src/cert/qnet';

const xml = (items: string) => `<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>${items}</items></body></response>`;

describe('합격률', () => {
  const row = (e: number[], p: number[]) => `<item><jmnm>정보처리기사</jmnm>${e.map((v, i) => `<ilecnt${i + 1}>${v}</ilecnt${i + 1}>`).join('')}${p.map((v, i) => `<ilpcnt${i + 1}>${v}</ilpcnt${i + 1}>`).join('')}</item>`;
  it('ilXcnt2~6 = 4년 전~기준년도, 응시 0 제외', () => {
    const ys = parsePassYears(xml(row([999, 0, 100, 200, 300, 400], [9, 0, 50, 60, 90, 100])), 2025);
    expect(ys.map((y) => y.year)).toEqual([2022, 2023, 2024, 2025]);
    expect(ys[3]).toEqual({ year: 2025, applied: 400, passed: 100 });
    const p = { written: ys, practical: [{ year: 2025, applied: 200, passed: 50 }] };
    expect(passShort(p)).toBe('필기 25% · 실기 25% (2025)');
    expect(passText(p)).toContain('필기 2025년 25% (응시 400명·합격 100명), 4년 평균 30%');
  });
  it('빈 값 null', () => {
    expect(passShort({ written: [], practical: [] })).toBeNull();
    expect(passText(null)).toBeNull();
  });
  it('URL', () => {
    expect(qnetPassUrl('k', 2025, '1320', 'Si')).toContain('/getEventYearSiList?serviceKey=k&baseYY=2025&jmCd=1320');
  });
});

describe('공개문제', () => {
  it('JSON 최신순', () => {
    const j = JSON.stringify({
      response: {
        header: { resultCode: '00' },
        body: { items: { item: [{ artlSeq: 1, title: 'A', regDttm: '20240101120000', seriesNm: '기사' }, { artlSeq: 2, title: 'B', modDttm: '20250301000000' }] } },
      },
    });
    const q = parseOpenQst(j);
    expect(q.map((x) => x.title)).toEqual(['B', 'A']);
    expect(q[1].date).toBe('2024-01-01');
    expect(openQstUrl('k', '1320')).toContain('qualgbCd=T&jmCd=1320');
  });
  it('오류 throw', () => {
    expect(() => parseOpenQst(JSON.stringify({ response: { header: { resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' } } }))).toThrow(/SERVICE_KEY/);
  });
});

describe('시험장소', () => {
  it('XML', () => {
    const a = parseExamArea(xml('<item><brchNm>서울</brchNm><examAreaNm>고양직업전문학교</examAreaNm><address>고양대로 1361</address><telNo>031-1</telNo></item>'));
    expect(a[0]).toMatchObject({ name: '고양직업전문학교', branch: '서울', tel: '031-1' });
    expect(examAreaUrl('k', '01')).toContain('ServiceKey=k&brchCd=01');
  });
});

describe('민간자격 등록정보', () => {
  it('등급 묶음, 폐지 뒤로', () => {
    const data = [
      { 자격명: '바리스타', 등록번호: '2009-1', 현재상태: '등록폐지', 등급명: '1급' },
      { 자격명: '바리스타', 등록번호: '2010-2', 현재상태: '정상', 등급명: '1급', 등급별직무내용: 'x', 기관홈페이지: 'a.com', 공인여부: 'N' },
      { 자격명: '바리스타', 등록번호: '2010-2', 현재상태: '정상', 등급명: '2급' },
    ];
    const r = parseKReg(JSON.stringify({ data }));
    expect(r[0].regNo).toBe('2010-2');
    expect(r[0].grades.map((g) => g.name)).toEqual(['1급', '2급']);
    expect(r[0].url).toBe('https://a.com');
    expect(r[1].status).toBe('등록폐지');
  });
  it('오류 throw', () => {
    expect(() => parseKReg('{"code":-401,"msg":"인증키 오류"}')).toThrow(/인증키/);
    expect(decodeURIComponent(kregUrl('k', '바리스타'))).toContain('cond[자격명::LIKE]=바리스타');
  });
});
