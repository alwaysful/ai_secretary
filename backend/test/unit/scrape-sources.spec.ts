import { gistAcademic } from '../../src/scrape/sources/gist-academic';
import { linkareer } from '../../src/scrape/sources/linkareer';
import { parseDday, wevity } from '../../src/scrape/sources/wevity';
import { kindsOf } from '../../src/ai/tools/scrape.tool';

const tz = 'Asia/Seoul';
const now = new Date('2026-11-23T01:00:00Z'); // KST 10:00

describe('gist-academic', () => {
  const html = `<div class="bd_list_wrap"><table><thead><tr><th>글번호</th></tr></thead><tbody>
  <tr id="BBSList224787" class="lstNtc"> <td class="ntt_no">공지</td> <td class="category">장학/납입금</td>
   <td class="title"> <a href="?mode=V&amp;no=224787&amp;GotoPage=1">[학사] 2027년 1학기 1차 국가근로장학금 신청 안내</a> </td>
   <td class="wrt"> 정서현 </td> <td class="inq_cnt"> 466 </td> <td class="reg_date"> 2026-11-20 </td> <td class="atch_nm"></td> </tr>
  <tr id="BBSList224628" class=""> <td class="ntt_no">101</td> <td class="category">학적</td>
   <td class="title"> <a href="?mode=V&amp;no=224628&amp;GotoPage=1">휴학 및 복학 신청기간 안내</a> </td>
   <td class="wrt"> 정범수 </td> <td class="inq_cnt"> 2205 </td> <td class="reg_date"> 2026-11-09 </td> </tr>
  <tr id="BBSList224628" class=""> <td class="title"> <a href="?mode=V&amp;no=224628&amp;GotoPage=1">휴학 및 복학 신청기간 안내</a> </td></tr>
  </tbody></table></div>`;

  it('parses rows, dedupes, absolute url, KST date', () => {
    const r = gistAcademic.parse(html, { baseUrl: gistAcademic.listUrl, now, tz });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      externalId: '224787',
      title: '[학사] 2027년 1학기 1차 국가근로장학금 신청 안내',
      url: 'https://www.gist.ac.kr/kr/html/sub05/050209.html?mode=V&no=224787',
      category: '장학/납입금',
      author: '정서현',
    });
    expect(r[0].postedAt?.toISOString()).toBe('2026-11-19T15:00:00.000Z');
  });
});

describe('wevity', () => {
  const html = `<ul class="list">
  <li class="top"><div class="tit"> 공모전명 </div></li>
  <li><div class="tit"> <a href="?c=find&amp;s=1&amp;gub=1&amp;gbn=view&amp;gp=1&amp;ix=112398">(4주) 글쓰기 참여자 모집 <span class="stat spec">SPECIAL</span> </a>
   <div class="sub-tit">분야 : 광고/마케팅, 기타</div> </div> <div class="organ">작필(作筆)</div>
   <div class="day"> D-8 <span class="dday soon">마감임박</span> </div> <div class="read">21,754</div></li>
  </ul>`;

  it('parses items, strips badges', () => {
    const r = wevity.parse(html, { baseUrl: wevity.listUrl, now, tz });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      externalId: '112398',
      title: '(4주) 글쓰기 참여자 모집',
      url: 'https://www.wevity.com/?c=find&s=1&gbn=view&ix=112398',
      category: '광고/마케팅, 기타',
      author: '작필(作筆)',
    });
    expect(r[0].deadline?.toISOString()).toBe('2026-11-30T15:00:00.000Z');
  });

  it('parseDday', () => {
    expect(parseDday('D-day', now, tz)?.toISOString()).toBe('2026-11-22T15:00:00.000Z');
    expect(parseDday('마감', now, tz)).toBeUndefined();
  });
});

describe('linkareer', () => {
  const state = {
    'Activity:366104': { __typename: 'Activity', id: '366104', title: '오디션', organizationName: '비웨이브', recruitCloseAt: 1798729199999, activityTypeID: 3 },
    'Activity:366200': { __typename: 'Activity', id: '366200', title: '대외활동', activityTypeID: 1 },
    'Activity:366300': { __typename: 'Activity', id: '366300', title: ' 영상  공모전 ', activityTypeID: 3, recruitCloseAt: null },
    'User:1': { __typename: 'User' },
  };
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { __APOLLO_STATE__: state } } })}</script></html>`;

  it('extracts contests from apollo state, newest first', () => {
    const r = linkareer.parse(html, { baseUrl: linkareer.listUrl, now, tz });
    expect(r.map((i) => i.externalId)).toEqual(['366300', '366104']);
    expect(r[0]).toMatchObject({ title: '영상 공모전', url: 'https://linkareer.com/activity/366300' });
    expect(r[1].deadline?.getTime()).toBe(1798729199999);
  });

  it('throws when structure changes', () => {
    expect(() => linkareer.parse('<html></html>', { baseUrl: '', now, tz })).toThrow();
  });
});

describe('scrape tool intent', () => {
  it.each([
    ['새 학사공지 있어?', ['notice']],
    ['요즘 공모전 뭐 있어', ['contest']],
    ['지스트 공지랑 공모전', ['notice', 'contest']],
    ['오늘 일정 알려줘', []],
  ])('%s', (t, k) => expect(kindsOf(t)).toEqual(k));
});
