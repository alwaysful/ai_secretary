import { clean, Parser, ScrapedItem } from './types';

interface ApolloActivity {
  __typename?: string;
  id?: string;
  title?: string;
  organizationName?: string;
  recruitCloseAt?: number | null;
  activityTypeID?: number;
}

/** 링커리어 목록 (/list/contest 등). Next.js __NEXT_DATA__ 의 Apollo 캐시에서 Activity 추출. robots.txt: Allow / */
export const linkareerParser: Parser = {
  id: 'linkareer',
  label: '링커리어',
  parse(html) {
    const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (!m) throw new Error('__NEXT_DATA__ 없음 (페이지 구조 변경?)');
    const data = JSON.parse(m[1]) as { props?: { pageProps?: { __APOLLO_STATE__?: Record<string, ApolloActivity> } } };
    const state = data.props?.pageProps?.__APOLLO_STATE__ ?? {};
    const acts = Object.values(state).filter((v) => v.__typename === 'Activity' && v.id && v.title);
    // 목록의 주 유형만 (광고로 섞인 다른 유형 제외)
    const freq = new Map<number | undefined, number>();
    for (const a of acts) freq.set(a.activityTypeID, (freq.get(a.activityTypeID) ?? 0) + 1);
    const main = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const out: ScrapedItem[] = acts
      .filter((v) => v.activityTypeID === main)
      .map((v) => ({
        externalId: v.id!,
        title: clean(v.title),
        url: `https://linkareer.com/activity/${v.id}`,
        author: clean(v.organizationName) || undefined,
        deadline: typeof v.recruitCloseAt === 'number' ? new Date(v.recruitCloseAt) : undefined,
      }));
    return out.sort((a, b) => Number(b.externalId) - Number(a.externalId));
  },
};
