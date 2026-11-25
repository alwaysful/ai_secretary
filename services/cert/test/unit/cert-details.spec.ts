import { CATALOG } from '../../src/cert/catalog';
import { expandDetail, loadDetails } from '../../src/cert/details';

describe('자격증 설명 JSON', () => {
  it('오류 없음, id 전부 목록에 있음', () => {
    const { details, issues } = loadDetails();
    expect(issues).toEqual([]);
    const ids = new Set(CATALOG.map((c) => c.id));
    expect(Object.keys(details).filter((id) => !ids.has(id))).toEqual([]);
    expect(details['it-ipe']?.[0].label).toBe('무엇');
  });
  it('양식 펼침·검사', () => {
    const d = expandDetail({ tpl: '기술사', what: 'a', subjects: 'b', use: 'c', study: 'd' });
    expect(Array.isArray(d) && d.find((x) => x.label === '필기')?.text).toContain('출제: b');
    expect(expandDetail({ tpl: '기술사', what: 'a' })).toMatch(/필수 값 없음/);
    expect(expandDetail({ tpl: '없음' })).toMatch(/모르는 양식/);
    expect(expandDetail([{ label: '링크', text: '', links: [{ label: 'x', url: 'ftp://x' }] }])).toMatch(/links/);
  });
});
