import { baseOfVariant, fieldOfName, fieldOfPrivate, isTechGrade, joinTags } from '../../src/cert/catalog';
import { kprivateUrl, parseKPrivate } from '../../src/cert/qnet';

describe('공인민간·국가전문 정리', () => {
  it('odcloud 응답 → 종목별 묶음', () => {
    const r = parseKPrivate(
      JSON.stringify({
        page: 1,
        perPage: 500,
        totalCount: 3,
        currentCount: 3,
        data: [
          { 자격종목: '의료기기 RA전문가', 등급: '2급', 자격관리자: '한국의료기기안전정보원', '소관 부처': '식품의약품안전처', '공인유효기간(만료)': '2027-12-31' },
          { 자격종목: '의료기기 RA전문가', 등급: '1급', 자격관리자: '한국의료기기안전정보원', '소관 부처': '식품의약품안전처', '공인유효기간(만료)': '2028-12-31' },
          { 자격종목: '신용분석사', 등급: '미입력', 자격관리자: '한국금융연수원', '소관 부처': '금융위원회' },
        ],
      }),
    );
    expect(r.total).toBe(3);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ name: '의료기기 RA전문가', grades: ['2급', '1급'], until: '2028-12-31' });
    expect(r.items[1].grades).toEqual([]);
    expect(joinTags(r.items[0].grades)).toBe('1~2급');
    expect(fieldOfPrivate(r.items[0].name, r.items[0].ministry)).toBe('보건/의료/복지');
    expect(fieldOfPrivate('신용분석사', '금융위원회')).toBe('금융/부동산');
  });

  it('odcloud 오류 응답은 throw', () => {
    expect(() => parseKPrivate(JSON.stringify({ code: -4, msg: '등록되지 않은 인증키 입니다.' }))).toThrow('등록되지 않은');
  });

  it('URL: 디코딩 키는 인코딩, 인코딩 키는 그대로', () => {
    expect(kprivateUrl('a+b/c==')).toContain('serviceKey=a%2Bb%2Fc%3D%3D');
    expect(kprivateUrl('a%2Bb')).toContain('serviceKey=a%2Bb');
  });

  it('국가전문 변형 이름 → 기본 이름', () => {
    expect(baseOfVariant('관광통역안내사(영어)')).toEqual({ base: '관광통역안내사', tag: '영어' });
    expect(baseOfVariant('1급 청소년상담사')).toEqual({ base: '청소년상담사', tag: '1급' });
    expect(baseOfVariant('정수시설운영관리사3급')).toEqual({ base: '정수시설운영관리사', tag: '3급' });
    expect(baseOfVariant('경매사')).toEqual({ base: '경매사', tag: null });
    expect(joinTags(['1급', '3급', '2급'])).toBe('1~3급');
    expect(joinTags(['영어', '일본어', '영어'])).toBe('영어·일본어');
  });

  it('등급·분야 판별', () => {
    expect(isTechGrade('산업기사')).toBe(true);
    expect(isTechGrade('경매사')).toBe(false);
    expect(isTechGrade(null)).toBe(false);
    expect(fieldOfName('관광통역안내사')).toBe('조리/미용/관광');
    expect(fieldOfName('경영지도사')).toBe('경영/사무/OA');
    expect(fieldOfName('청소년지도사')).toBe('교육/상담/인문');
    expect(fieldOfName('행정사')).toBe('법률/행정');
  });
});
