import { parseQnet, seriesOf, ymd } from '../../src/cert/qnet';

describe('qnet', () => {
  it('JSON body.items 배열', () => {
    const r = parseQnet(
      JSON.stringify({
        header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
        body: {
          items: [
            {
              implYy: '2026',
              implSeq: 1,
              qualgbCd: 'T',
              description: '국가기술자격 정기 기사 1회',
              docRegStartDt: '20260113',
              docRegEndDt: '20260116',
              docExamStartDt: '20260207',
              docExamEndDt: '20260303',
              docPassDt: '20260311',
              pracRegStartDt: '20260324',
              pracRegEndDt: '20260327',
            },
          ],
        },
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].doc?.regStart?.toISOString()).toBe('2026-01-12T15:00:00.000Z');
    expect(r[0].prac?.examStart).toBeNull();
    expect(seriesOf(r[0].description)).toBe('qnet-기사');
  });

  it('response.body.items.item 단일 객체', () => {
    const r = parseQnet(JSON.stringify({ response: { header: { resultCode: '00' }, body: { items: { item: { implYy: '2026', description: '정기 기능사 2회' } } } } }));
    expect(r[0].description).toBe('정기 기능사 2회');
    expect(r[0].doc).toBeNull();
  });

  it('XML 및 키 오류', () => {
    const xml = '<response><header><resultCode>00</resultCode></header><body><items><item><implYy>2026</implYy><description>정기 기술사 138회</description><docRegStartDt>20260105</docRegStartDt></item></items></body></response>';
    expect(seriesOf(parseQnet(xml)[0].description)).toBe('qnet-기술사');
    expect(() =>
      parseQnet('<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>'),
    ).toThrow(/SERVICE_KEY/);
  });

  it('묶음 판별', () => {
    expect(seriesOf('정기 기능장 79회')).toBe('qnet-기능장');
    expect(seriesOf('정기 산업기사 3회')).toBe('qnet-기사');
    expect(seriesOf('상시 기능사')).toBeNull();
    expect(ymd('2026-02-3')).toBeNull();
  });
});

describe('qnet 종목 목록', () => {
  it('XML 종목 파싱', () => {
    const { parseJmList } = jest.requireActual('../../src/cert/qnet') as typeof import('../../src/cert/qnet');
    const xml =
      '<response><header><resultCode>00</resultCode></header><body><items><item><jmcd>1320</jmcd><jmfldnm>정보처리기사</jmfldnm><obligfldnm>정보통신</obligfldnm><qualgbnm>국가기술자격</qualgbnm><seriesnm>기사</seriesnm></item><item><jmcd></jmcd></item></items></body></response>';
    expect(parseJmList(xml)).toEqual([{ jmCd: '1320', name: '정보처리기사', grade: '기사', obligfld: '정보통신', qualgb: '국가기술자격' }]);
  });
});
