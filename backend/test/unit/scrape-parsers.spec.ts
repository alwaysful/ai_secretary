import { detectParser, parseDday, parsePeriod, runParser } from '../../src/scrape/parsers';
import { contestkoreaParser } from '../../src/scrape/parsers/contestkorea';
import { egovParser } from '../../src/scrape/parsers/egov';
import { genericParser } from '../../src/scrape/parsers/generic';
import { gistParser } from '../../src/scrape/parsers/gist';
import { kboardParser } from '../../src/scrape/parsers/kboard';
import { linkareerParser } from '../../src/scrape/parsers/linkareer';
import { rssParser } from '../../src/scrape/parsers/rss';
import { wevityParser } from '../../src/scrape/parsers/wevity';

const tz = 'Asia/Seoul';
const now = new Date('2026-11-23T01:00:00Z'); // KST 10:00
const ctx = (baseUrl: string) => ({ baseUrl, now, tz });

const GIST = `<div class="bd_list_wrap"><table><tbody>
  <tr id="BBSList224787" class="lstNtc"> <td class="ntt_no">공지</td> <td class="category">장학/납입금</td>
   <td class="title"> <a href="?mode=V&amp;no=224787&amp;GotoPage=1">[학사] 2027년 1학기 1차 국가근로장학금 신청 안내</a> </td>
   <td class="wrt"> 정서현 </td> <td class="reg_date"> 2026-11-20 </td></tr>
  <tr id="BBSList224628"> <td class="category">학적</td>
   <td class="title"> <a href="?mode=V&amp;no=224628&amp;GotoPage=1">휴학 및 복학 신청기간 안내</a> </td>
   <td class="wrt"> 정범수 </td> <td class="reg_date"> 2026-11-09 </td> </tr>
  <tr id="BBSList224628"> <td class="title"> <a href="?mode=V&amp;no=224628&amp;GotoPage=1">휴학 및 복학 신청기간 안내</a> </td></tr>
  </tbody></table></div>`;

const KBOARD = `<div class="kboard-list"><table><tbody>
<tr class="kboard-list-notice"> <td class="kboard-list-uid">공지사항</td> <td class="kboard-list-title"> <a href="/news-events/notice/?uid=149&amp;mod=document&amp;pageid=1"> <div class="kboard-default-cut-strings"> 제6회 GIFT 및 대학원 과정변경 선발 안내 <span class="kboard-comments-count">(2)</span> </div> </a> <div class="kboard-mobile-contents"><span class="contents-item kboard-date">2026.11.10</span></div> </td> <td class="kboard-list-user">관리자</td> <td class="kboard-list-date">2026.11.10</td> </tr>
<tr class=""> <td class="kboard-list-uid">105</td> <td class="kboard-list-title"> <a href="/news-events/notice/?uid=134&amp;mod=document"> <div class="kboard-default-cut-strings"> 2026년 동계 인턴십 프로그램 신청 접수 안내 </div> </a> </td> <td class="kboard-list-user">관리자</td> <td class="kboard-list-date">2025.11.13</td> </tr>
</tbody></table></div>`;

const EGOV = `<table><tbody>
<tr> <td data-cell-header="번호">19</td> <td data-cell-header="제목" class="subject"> <a href="#view" onclick="javascript: fn_search_detail('B000000103499En8fO7h'); return false;">[NST 국가과학AI연구센터(NAIS)] 채용홍보</a> </td> <td data-cell-header="작성자">AI학과</td> <td data-cell-header="조회수">285</td> <td data-cell-header="Date">2026-10-06</td> </tr>
</tbody></table>`;

const WEVITY = `<ul class="list">
  <li class="top"><div class="tit"> 공모전명 </div></li>
  <li><div class="tit"> <a href="?c=find&amp;s=1&amp;gub=1&amp;gbn=view&amp;gp=1&amp;ix=112398">(4주) 글쓰기 참여자 모집 <span class="stat spec">SPECIAL</span> </a>
   <div class="sub-tit">분야 : 광고/마케팅, 기타</div> </div> <div class="organ">작필(作筆)</div>
   <div class="day"> D-8 <span class="dday soon">마감임박</span> </div></li>
  </ul>`;

const linkareerHtml = (state: object) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { __APOLLO_STATE__: state } } })}</script></html>`;

describe('gist', () => {
  it('parses rows, dedupes, stable url, KST date', () => {
    const r = gistParser.parse(GIST, ctx('https://www.gist.ac.kr/kr/html/sub05/050209.html'));
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      externalId: '224787',
      url: 'https://www.gist.ac.kr/kr/html/sub05/050209.html?mode=V&no=224787',
      category: '장학/납입금',
      author: '정서현',
    });
    expect(r[0].postedAt?.toISOString()).toBe('2026-11-19T15:00:00.000Z');
  });
});

describe('kboard', () => {
  it('parses title without comment count, date', () => {
    const r = kboardParser.parse(KBOARD, ctx('https://physics.gist.ac.kr/news-events/notice/'));
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      externalId: '149',
      title: '제6회 GIFT 및 대학원 과정변경 선발 안내',
      url: 'https://physics.gist.ac.kr/news-events/notice/?uid=149&mod=document',
      author: '관리자',
    });
    expect(r[0].postedAt?.toISOString()).toBe('2026-11-09T15:00:00.000Z');
  });
});

describe('egov', () => {
  it('builds view url from onclick id', () => {
    const r = egovParser.parse(EGOV, ctx('https://ai.gist.ac.kr/prog/bbsArticle/BBSMSTR_000000012331/list.do'));
    expect(r).toEqual([
      expect.objectContaining({
        externalId: 'B000000103499En8fO7h',
        title: '[NST 국가과학AI연구센터(NAIS)] 채용홍보',
        url: 'https://ai.gist.ac.kr/prog/bbsArticle/BBSMSTR_000000012331/B000000103499En8fO7h/view.do',
        author: 'AI학과',
      }),
    ]);
    expect(r[0].postedAt?.toISOString()).toBe('2026-10-05T15:00:00.000Z');
  });
});

describe('wevity', () => {
  it('parses items, strips badges, D-day', () => {
    const r = wevityParser.parse(WEVITY, ctx('https://www.wevity.com/?c=find&s=1&gub=1'));
    expect(r[0]).toMatchObject({ externalId: '112398', title: '(4주) 글쓰기 참여자 모집', author: '작필(作筆)' });
    expect(r[0].deadline?.toISOString()).toBe('2026-11-30T15:00:00.000Z');
    expect(parseDday('D-day', now, tz)?.toISOString()).toBe('2026-11-22T15:00:00.000Z');
  });
});

describe('linkareer', () => {
  it('keeps main activity type, newest first', () => {
    const r = linkareerParser.parse(
      linkareerHtml({
        'Activity:1': { __typename: 'Activity', id: '366104', title: '오디션', organizationName: '비웨이브', recruitCloseAt: 1798729199999, activityTypeID: 3 },
        'Activity:2': { __typename: 'Activity', id: '366200', title: '광고', activityTypeID: 1 },
        'Activity:3': { __typename: 'Activity', id: '366300', title: ' 영상  공모전 ', activityTypeID: 3 },
      }),
      ctx('https://linkareer.com/list/contest'),
    );
    expect(r.map((i) => i.externalId)).toEqual(['366300', '366104']);
    expect(r[0].title).toBe('영상 공모전');
  });
  it('throws when structure changes', () => {
    expect(() => linkareerParser.parse('<html></html>', ctx('https://linkareer.com/'))).toThrow();
  });
});

describe('rss', () => {
  it('parses rss 2.0 and atom', () => {
    const rss = `<?xml version="1.0"?><rss><channel><item><title>공지 A</title><link>https://x.com/a</link><guid>a1</guid><pubDate>Fri, 20 Nov 2026 01:00:00 GMT</pubDate></item></channel></rss>`;
    const atom = `<?xml version="1.0"?><feed><entry><title>B</title><link href="/b"/><id>b1</id><updated>2026-11-20T00:00:00Z</updated></entry></feed>`;
    expect(rssParser.parse(rss, ctx('https://x.com/feed'))[0]).toMatchObject({ externalId: 'a1', title: '공지 A', url: 'https://x.com/a' });
    expect(rssParser.parse(atom, ctx('https://y.com/feed'))[0]).toMatchObject({ externalId: 'b1', url: 'https://y.com/b' });
  });
});

describe('generic', () => {
  const html = `<html><nav><ul><li><a href="/menu1">메뉴 하나 링크</a></li><li><a href="/menu2">메뉴 둘 링크</a></li><li><a href="/menu3">메뉴 셋 링크</a></li></ul></nav>
  <ul class="board">
    <li class="row"><a class="t" href="/bbs/view?id=3&page=2">세 번째 공지 제목입니다</a><span>2026-11-20</span></li>
    <li class="row"><a class="t" href="/bbs/view?id=2&page=2">두 번째 공지 제목입니다</a><span>2026-11-19</span></li>
    <li class="row"><a class="t" href="/bbs/view?id=1&page=2">첫 번째 공지 제목입니다</a><span>2026-11-18</span></li>
  </ul>
  <div class="side"><ul><li><a href="/x">사이드 링크 하나</a></li><li><a href="/y">사이드 링크 둘이</a></li><li><a href="/z">사이드 링크 셋이</a></li></ul></div></html>`;

  it('finds repeated dated link group, drops page params', () => {
    const r = genericParser.parse(html, ctx('https://dept.example.ac.kr/bbs/list?page=2'));
    expect(r.map((i) => i.url)).toEqual([
      'https://dept.example.ac.kr/bbs/view?id=3',
      'https://dept.example.ac.kr/bbs/view?id=2',
      'https://dept.example.ac.kr/bbs/view?id=1',
    ]);
    expect(r[0].postedAt?.toISOString()).toBe('2026-11-19T15:00:00.000Z');
  });

  it('uses itemSelector when given', () => {
    const r = genericParser.parse(html, { ...ctx('https://dept.example.ac.kr/'), itemSelector: '.side a' });
    expect(r).toHaveLength(3);
  });
});

describe('detect', () => {
  it.each([
    [KBOARD, 'https://physics.gist.ac.kr/x', 'kboard'],
    [GIST, 'https://www.gist.ac.kr/x', 'gist'],
    [EGOV, 'https://ai.gist.ac.kr/x', 'egov'],
    ['<?xml version="1.0"?><rss></rss>', 'https://a.com/rss', 'rss'],
    ['<html></html>', 'https://a.com/', 'generic'],
  ])('%#', (html, url, id) => expect(detectParser(html, url).id).toBe(id));

  it('runParser auto', () => {
    expect(runParser('auto', EGOV, ctx('https://ai.gist.ac.kr/prog/bbsArticle/B/list.do')).parser.id).toBe('egov');
  });
});

describe('detail period', () => {
  it('parsePeriod', () => {
    const r = parsePeriod('접수기간 2026-11-17 ~ 2026-11-30 D-7', tz);
    expect(r.startsAt?.toISOString()).toBe('2026-11-16T15:00:00.000Z');
    expect(r.deadline?.toISOString()).toBe('2026-11-30T14:59:59.999Z');
    expect(parsePeriod('모집 기간: 2026.12.01(월) ~ 2026.12.15(월)', tz).startsAt?.toISOString()).toBe('2026-11-30T15:00:00.000Z');
    expect(parsePeriod('기간 없음', tz)).toEqual({});
  });

  it('wevity detail', () => {
    const html = '<ul><li class="dday-area"> <span class="tit">접수기간</span> 2026-11-17 ~ 2026-11-30 <span class="cil-dday">D-7</span> </li></ul><div class="comm-desc">청년 글쓰기 프로그램. 활동 기간: 2026.12.07(월) ~ 2027.01.03(일) 온라인 진행</div>';
    const r = wevityParser.parseDetail!(html, ctx('https://www.wevity.com/?c=find&s=1&gbn=view&ix=1'));
    expect(r.startsAt?.toISOString()).toBe('2026-11-16T15:00:00.000Z');
    expect(r.eventStartsAt?.toISOString()).toBe('2026-12-06T15:00:00.000Z');
    expect(r.eventEndsAt?.toISOString()).toBe('2027-01-03T14:59:59.999Z');
    expect(r.summary).toMatch(/^청년 글쓰기 프로그램/);
  });

  it('linkareer detail', () => {
    const html = linkareerHtml({ 'Activity:366104': { __typename: 'Activity', id: '366104', recruitStartAt: 1794495600000, recruitCloseAt: 1796914799999 } });
    const r = linkareerParser.parseDetail!(html, ctx('https://linkareer.com/activity/366104'));
    expect(r.startsAt?.getTime()).toBe(1794495600000);
    expect(r.deadline?.getTime()).toBe(1796914799999);
  });
});

describe('contestkorea', () => {
  const html = `<ul class="list_style_2"><li class="imminent"> <div class="title"> <a href="view.php?int_gbn=1&amp;Txt_bcode=031610001&amp;str_no=202611140012&amp;page=1"> <span class="category">요리•뷰티•배우•오디션</span> <img src="/x.gif"> <span class="txt">2026 누아엔터테인먼트 오디션</span> </a> </div> <ul class="host"> <li class="icon_1"><strong>주최</strong> . 누아엔터테인먼트</li> <li class="icon_2"><strong>대상</strong> . 대학생 , 일반인 </li> </ul> <div class="date"> <div class="date-detail"> <span class="step-1"><em>접수</em> 11.13~01.05 </span> <span class="step-2"><em>심사</em> 01.06~01.20 </span> <span class="step-3"><em>발표</em> 01.25 </span> </div> </div></li></ul>`;
  it('parses list with period, year rollover', () => {
    const r = contestkoreaParser.parse(html, ctx('https://www.contestkorea.com/sub/list.php?int_gbn=1'));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      externalId: '202611140012',
      title: '2026 누아엔터테인먼트 오디션',
      url: 'https://www.contestkorea.com/sub/view.php?int_gbn=1&Txt_bcode=031610001&str_no=202611140012',
      category: '요리/뷰티/배우/오디션',
      author: '누아엔터테인먼트',
    });
    expect(r[0].startsAt?.toISOString()).toBe('2026-11-12T15:00:00.000Z');
    expect(r[0].deadline?.toISOString()).toBe('2027-01-05T14:59:59.999Z');
    expect(r[0].eventStartsAt?.toISOString()).toBe('2027-01-05T15:00:00.000Z');
    expect(r[0].eventEndsAt?.toISOString()).toBe('2027-01-25T14:59:59.999Z');
    expect(r[0].summary).toBe('대상: 대학생, 일반인');
  });
  it('detect', () => expect(detectParser(html, 'https://www.contestkorea.com/sub/list.php').id).toBe('contestkorea'));
});
