import { useCallback, useEffect, useState } from 'react';
import { api, NewsCategory, NewsPreview, NewsSite, NewsSiteInput } from '../../shared/api';
import { errMsg } from './NewsPage';

const when = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

interface Draft {
  id?: string;
  name: string;
  url: string;
  parser: string;
  itemSelector: string;
  categoryId: string;
}

const emptyDraft = (categoryId: string | null): Draft => ({ name: '', url: '', parser: 'auto', itemSelector: '', categoryId: categoryId ?? '' });

/** 사이트 추가·수정 폼. 저장 전 미리보기로 글이 잘 잡히는지 확인 */
function SiteForm(props: {
  draft: Draft;
  cats: NewsCategory[];
  parsers: { id: string; label: string }[];
  onSave: (d: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState(props.draft);
  const [preview, setPreview] = useState<NewsPreview | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="news-form">
      <label>
        이름
        <input value={d.name} onChange={set('name')} placeholder="예: GIST 화학과 공지" maxLength={60} />
      </label>
      <label>
        게시판 주소 (목록 페이지 또는 RSS)
        <input value={d.url} onChange={set('url')} placeholder="https://..." />
      </label>
      <label>
        카테고리
        <select value={d.categoryId} onChange={set('categoryId')}>
          <option value="">미분류</option>
          {props.cats
            .filter((c) => c.id)
            .map((c) => (
              <option key={c.id} value={c.id!}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        게시판 형식
        <select value={d.parser} onChange={set('parser')}>
          {props.parsers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>고급: 글 링크 CSS 선택자</summary>
        <input value={d.itemSelector} onChange={set('itemSelector')} placeholder="예: td.title a (비우면 자동)" maxLength={300} />
      </details>
      <div className="news-form-btns">
        <button
          className="ghost"
          disabled={busy || !d.url.trim()}
          onClick={() =>
            void run(async () => setPreview(await api.newsPreview({ url: d.url, parser: d.parser, itemSelector: d.itemSelector || null })))
          }
        >
          미리보기
        </button>
        <button className="primary" disabled={busy || !d.url.trim()} onClick={() => void run(() => props.onSave(d))}>
          저장
        </button>
        <button className="ghost" disabled={busy} onClick={props.onCancel}>
          취소
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      {preview && (
        <div className="news-preview">
          <p className="muted">
            {preview.parserLabel}로 {preview.count}개 찾음. 처음 10개:
          </p>
          <ol>
            {preview.items.map((i) => (
              <li key={i.url}>
                <a href={i.url} target="_blank" rel="noreferrer">
                  {i.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** 카테고리 추가·이름변경·삭제, 사이트 추가·수정·삭제·켜기/끄기 */
export function NewsManage(props: { onDone: () => void }) {
  const [cats, setCats] = useState<NewsCategory[] | null>(null);
  const [parsers, setParsers] = useState<{ id: string; label: string }[]>([{ id: 'auto', label: '자동 감지' }]);
  const [newCat, setNewCat] = useState('');
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.newsCategories().then(setCats, (e: unknown) => setError(errMsg(e))), []);

  useEffect(() => {
    void load();
    api.newsParsers().then(setParsers, () => undefined);
  }, [load]);

  const act = async (fn: () => Promise<NewsCategory[] | unknown>) => {
    setBusy(true);
    try {
      const r = await fn();
      if (Array.isArray(r)) setCats(r as NewsCategory[]);
      else await load();
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async (d: Draft) => {
    const body: NewsSiteInput = {
      name: d.name.trim(),
      url: d.url.trim(),
      parser: d.parser,
      itemSelector: d.itemSelector.trim() || null,
      categoryId: d.categoryId || null,
    };
    const r = d.id ? await api.newsUpdateSite(d.id, body) : await api.newsCreateSite({ ...body, url: d.url.trim() });
    setCats(r);
    setForm(null);
  };

  const edit = (s: NewsSite) =>
    setForm({ id: s.id, name: s.name, url: s.url, parser: s.parser, itemSelector: s.itemSelector ?? '', categoryId: s.categoryId ?? '' });

  const move = (i: number, dir: -1 | 1) => {
    const list = (cats ?? []).filter((c) => c.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    void act(async () => {
      await api.newsUpdateCategory(list[i].id!, { position: j });
      return api.newsUpdateCategory(list[j].id!, { position: i });
    });
  };

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onDone}>
          ← 새 소식
        </button>
        <h1>카테고리·사이트 관리</h1>
      </header>
      <div className="subbody">
        <p className="muted">같은 카테고리 안에서 제목이 같은(비슷한) 글은 하나로 합쳐 링크를 모두 보여줌. 사이트당 1시간에 목록 1번만 읽음.</p>
        <div className="news-tools">
          <input className="news-search" placeholder="새 카테고리 이름" value={newCat} maxLength={40} onChange={(e) => setNewCat(e.target.value)} />
          <button
            className="ghost"
            disabled={busy || !newCat.trim()}
            onClick={() =>
              void act(async () => {
                const r = await api.newsCreateCategory(newCat.trim());
                setNewCat('');
                return r;
              })
            }
          >
            ＋ 카테고리
          </button>
          <button className="primary" disabled={busy} onClick={() => setForm(emptyDraft(cats?.find((c) => c.id)?.id ?? null))}>
            ＋ 사이트 추가
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {form && !form.id && <SiteForm draft={form} cats={cats ?? []} parsers={parsers} onSave={save} onCancel={() => setForm(null)} />}
        {cats === null && <p className="muted">불러오는 중…</p>}
        {cats?.map((c, ci) => (
          <section key={c.id ?? 'none'} className="news-cat">
            <div className="news-cat-head">
              {rename && rename.id === c.id ? (
                <>
                  <input value={rename.name} maxLength={40} onChange={(e) => setRename({ ...rename, name: e.target.value })} />
                  <button
                    className="ghost"
                    disabled={busy || !rename.name.trim()}
                    onClick={() =>
                      void act(async () => {
                        const r = await api.newsUpdateCategory(rename.id, { name: rename.name.trim() });
                        setRename(null);
                        return r;
                      })
                    }
                  >
                    저장
                  </button>
                  <button className="ghost" onClick={() => setRename(null)}>
                    취소
                  </button>
                </>
              ) : (
                <>
                  <h2>{c.name}</h2>
                  {c.id && (
                    <span className="news-cat-acts">
                      <button className="ghost" title="위로" disabled={busy || ci === 0} onClick={() => move(ci, -1)}>
                        ↑
                      </button>
                      <button className="ghost" title="아래로" disabled={busy || ci >= cats.filter((x) => x.id).length - 1} onClick={() => move(ci, 1)}>
                        ↓
                      </button>
                      <button className="ghost" onClick={() => setRename({ id: c.id!, name: c.name })}>
                        ✎ 이름
                      </button>
                      <button className="ghost" onClick={() => setForm(emptyDraft(c.id))}>
                        ＋ 사이트
                      </button>
                      <button
                        className="ghost danger"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`'${c.name}' 카테고리를 삭제할까요?\n사이트는 미분류로 옮겨짐.`)) {
                            void act(() => api.newsDeleteCategory(c.id!));
                          }
                        }}
                      >
                        삭제
                      </button>
                    </span>
                  )}
                </>
              )}
            </div>
            {c.sites.length === 0 && <p className="muted">사이트 없음</p>}
            <ul className="news-sites">
              {c.sites.map((s) => (
                <li key={s.id}>
                  {form?.id === s.id ? (
                    <SiteForm draft={form} cats={cats} parsers={parsers} onSave={save} onCancel={() => setForm(null)} />
                  ) : (
                    <>
                      <label className="news-site-name">
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          disabled={busy}
                          title="켜기/끄기"
                          onChange={(e) => void act(() => api.newsUpdateSite(s.id, { enabled: e.target.checked }))}
                        />
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.name}
                        </a>
                      </label>
                      <small className="muted news-site-state">
                        {parsers.find((p) => p.id === s.parser)?.label ?? s.parser} ·{' '}
                        {s.lastOkAt ? `확인 ${when.format(new Date(s.lastOkAt))}` : '아직 수집 안 됨'}
                        {s.lastError && <span className="error"> · 실패: {s.lastError}</span>}
                      </small>
                      <span className="news-site-acts">
                        <button className="ghost" disabled={busy} title="이 사이트만 지금 확인" onClick={() => void act(() => api.newsRefresh(s.id))}>
                          ↻
                        </button>
                        <button className="ghost" onClick={() => edit(s)}>
                          ✎
                        </button>
                        <button
                          className="ghost danger"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`'${s.name}' 사이트와 모은 글을 삭제할까요?`)) void act(() => api.newsDeleteSite(s.id));
                          }}
                        >
                          삭제
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
