import { useCallback, useEffect, useState } from 'react';
import { CardFields, Deck, VCard, vocab } from './api';
import { Speak } from './CardFace';
import { errMsg, fmtIv } from './lib';

const FILTERS: [string, string][] = [
  ['', '전체'],
  ['new', '새 카드'],
  ['learning', '학습 중'],
  ['review', '복습'],
  ['unknown', '모름'],
  ['known', '외움'],
  ['wrong', '많이 틀림'],
  ['starred', '★ 별표'],
];
const STATE: Record<VCard['state'], string> = { new: '새', learning: '학습', relearning: '재학습', review: '복습' };
const PAGE = 50;

type Form = Required<Omit<CardFields, 'tags'>> & { tags: string };
const empty: Form = { front: '', back: '', reading: '', example: '', exampleMeaning: '', note: '', tags: '' };
const toForm = (c: VCard): Form => ({
  front: c.front,
  back: c.back,
  reading: c.reading ?? '',
  example: c.example ?? '',
  exampleMeaning: c.exampleMeaning ?? '',
  note: c.note ?? '',
  tags: c.tags.join(' '),
});
const fromForm = (f: Form): CardFields => ({ ...f, tags: f.tags.split(/[,\s]+/).filter(Boolean) });

function CardForm(props: { init: Form; onSave: (f: Form) => Promise<boolean>; onCancel?: () => void; label: string }) {
  const [f, setF] = useState(props.init);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      if (await props.onSave(f)) setF(empty);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="vc-form">
      <input placeholder="단어 (앞) *" value={f.front} onChange={set('front')} />
      <input placeholder="뜻 (뒤) *" value={f.back} onChange={set('back')} />
      <input placeholder="읽기·발음" value={f.reading} onChange={set('reading')} />
      <input placeholder="태그 (띄어쓰기)" value={f.tags} onChange={set('tags')} />
      <input placeholder="예문" value={f.example} onChange={set('example')} />
      <input placeholder="예문 뜻" value={f.exampleMeaning} onChange={set('exampleMeaning')} />
      <input placeholder="메모" value={f.note} onChange={set('note')} className="wide" />
      <div className="chips wide">
        <button className="primary" disabled={busy || !f.front.trim() || !f.back.trim()} onClick={() => void save()}>
          {props.label}
        </button>
        {props.onCancel && (
          <button className="ghost" onClick={props.onCancel}>
            취소
          </button>
        )}
      </div>
    </div>
  );
}

/** 단어 목록: 검색·필터·별표·편집·삭제·추가 */
export function CardList(props: { deck: Deck; onChange: () => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ items: VCard[]; total: number } | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(
    () =>
      vocab.cards(props.deck.id, { q: q.trim() || undefined, filter: filter || undefined, skip: page * PAGE, take: PAGE }).then(setData, (e: unknown) => setErr(errMsg(e))),
    [props.deck.id, q, filter, page],
  );
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const act = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setErr('');
    try {
      await fn();
      await load();
      props.onChange();
      return true;
    } catch (e) {
      setErr(errMsg(e));
      return false;
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const now = Date.now();

  return (
    <div className="vc-list">
      <div className="chips">
        <input
          className="vc-search"
          placeholder="검색 (단어·뜻·읽기·태그)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          {FILTERS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <button className="ghost" onClick={() => setAdding((a) => !a)}>
          ＋ 카드 추가
        </button>
        {data && <span className="muted">{data.total.toLocaleString('ko-KR')}장</span>}
      </div>
      {adding && (
        <CardForm
          init={empty}
          label="추가"
          onSave={(f) => act(() => vocab.addCard(props.deck.id, fromForm(f)))}
          onCancel={() => setAdding(false)}
        />
      )}
      {err && <p className="error">{err}</p>}
      {!data ? (
        <p className="muted">불러오는 중…</p>
      ) : data.items.length === 0 ? (
        <p className="muted">카드 없음</p>
      ) : (
        <ul className="vc-rows">
          {data.items.map((c) =>
            edit === c.id ? (
              <li key={c.id}>
                <CardForm
                  init={toForm(c)}
                  label="저장"
                  onSave={(f) => act(() => vocab.updateCard(c.id, fromForm(f))).then((ok) => (ok && setEdit(null), ok))}
                  onCancel={() => setEdit(null)}
                />
              </li>
            ) : (
              <li key={c.id} className="vc-row">
                <button
                  className={`vc-starbtn${c.starred ? ' on' : ''}`}
                  title="별표"
                  onClick={() => void act(() => vocab.updateCard(c.id, { starred: !c.starred }))}
                >
                  {c.starred ? '★' : '☆'}
                </button>
                <div className="vc-row-main">
                  <div>
                    <b lang={props.deck.language ?? undefined}>{c.front}</b>
                    {c.reading && <span className="muted"> {c.reading}</span>}
                    <Speak text={c.front} lang={props.deck.language} />
                  </div>
                  <div>{c.back}</div>
                  {c.example && <div className="muted vc-row-ex">{c.example}</div>}
                </div>
                <div className="vc-row-meta">
                  <span className={`vc-badge s-${c.state}`}>{STATE[c.state]}</span>
                  {c.state !== 'new' && <span className="muted">{new Date(c.due).getTime() <= now ? '지금' : fmtIv(new Date(c.due).getTime() - now) + ' 뒤'}</span>}
                  {c.known && <span className="vc-badge s-known">외움</span>}
                  {c.wrongCount > 0 && <span className="vc-badge s-wrong">틀림 {c.wrongCount}</span>}
                </div>
                <div className="vc-row-act">
                  <button className="ghost" onClick={() => setEdit(c.id)} title="수정">
                    ✎
                  </button>
                  <button
                    className="ghost danger"
                    title="삭제"
                    onClick={() => {
                      if (window.confirm(`삭제할까요?\n${c.front} — ${c.back}`)) void act(() => vocab.removeCard(c.id));
                    }}
                  >
                    🗑
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {pages > 1 && (
        <div className="chips vc-pager">
          <button className="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ←
          </button>
          <span className="muted">
            {page + 1} / {pages}
          </span>
          <button className="ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            →
          </button>
        </div>
      )}
    </div>
  );
}
