import { parseKPro } from '../../src/cert/qnet';

describe('국가전문자격정보', () => {
  it('등급은 괄호 밖 쉼표로만 나눔, 내용없음은 빈값', () => {
    const r = parseKPro(
      JSON.stringify({
        totalCount: 2,
        data: [
          { 자격명: '자동차운전면허', 등급: '제1종(보통, 대형), 제2종(보통, 소형)', 관련법: '도로교통법', 소관부처: '경찰청', 시행기관: '도로교통공단', 시행기관홈페이지: 'www.koroad.or.kr', 비고: '내용없음' },
          { 자격명: '의사', 등급: '내용없음', 관련법: '의료법', 소관부처: '보건복지부', 시행기관: '한국보건의료인국가시험원', 시행기관홈페이지: '내용없음' },
        ],
      }),
    );
    expect(r[0].grades).toEqual(['제1종(보통, 대형)', '제2종(보통, 소형)']);
    expect(r[0].url).toBe('https://www.koroad.or.kr');
    expect(r[1].grades).toEqual([]);
    expect(r[1].url).toBeNull();
  });
});
