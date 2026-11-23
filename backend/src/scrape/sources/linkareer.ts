import { clean, ScrapedItem, ScrapeSource } from './source';

interface ApolloActivity {
  __typename?: string;
  id?: string;
  title?: string;
  organizationName?: string;
  recruitCloseAt?: number | null;
  activityTypeID?: number;
}

/** 링커리어 공모전 목록. Next.js __NEXT_DATA__ 의 Apollo 캐시에서 Activity 추출. robots.txt: Allow / */
export const linkareer: ScrapeSource = {
  id: 'linkareer',
  name: '링커리어 공모전',
  kind: 'contest',
  homeUrl: 'https://linkareer.com/list/contest',
  listUrl: 'https://linkareer.com/list/contest',
  parse(html) {
    const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (!m) throw new Error('__NEXT_DATA__ 없음 (페이지 구조 변경?)');
    const data = JSON.parse(m[1]) as { props?: { pageProps?: { __APOLLO_STATE__?: Record<string, ApolloActivity> } } };
    const state = data.props?.pageProps?.__APOLLO_STATE__ ?? {};
    const out: ScrapedItem[] = [];
    for (const v of Object.values(state)) {
      // activityTypeID 3 = 공모전
      if (v.__typename !== 'Activity' || !v.id || !v.title || v.activityTypeID !== 3) continue;
      out.push({
        externalId: v.id,
        title: clean(v.title),
        url: `https://linkareer.com/activity/${v.id}`,
        author: clean(v.organizationName) || undefined,
        deadline: typeof v.recruitCloseAt === 'number' ? new Date(v.recruitCloseAt) : undefined,
      });
    }
    return out.sort((a, b) => Number(b.externalId) - Number(a.externalId));
  },
};
