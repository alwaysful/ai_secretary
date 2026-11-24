import { useCallback, useEffect, useState } from 'react';
import { CardList } from './CardList';
import { Deck, vocab } from './api';
import { DeckSettings } from './DeckSettings';
import { DeckStats } from './DeckStats';
import { FormatGuide, Importer } from './Importer';
import { errMsg } from './lib';
import { Quiz } from './Quiz';
import { Review } from './Review';
import { RoundView } from './RoundView';
import './vocab.css';

type Tab = 'review' | 'round' | 'quiz' | 'list' | 'stats' | 'settings';
const TABS: [Tab, string][] = [
  ['review', '🔁 복습'],
  ['round', '📖 회독'],
  ['quiz', '❓ 퀴즈'],
  ['list', '📋 단어'],
  ['stats', '📊 통계'],
  ['settings', '⚙️ 설정'],
];

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 무시 */
    }
  },
};

function DeckCard(props: { d: Deck; onOpen: (t: Tab) => void }) {
  const s = props.d.summary;
  const due = s.today.new + s.today.learn + s.today.review;
  const pct = s.total ? Math.round((s.known / s.total) * 100) : 0;
  return (
    <div className="card vc-deck">
      <button className="vc-deck-main" onClick={() => props.onOpen('review')}>
        <h2>{props.d.name}</h2>
        {props.d.description && <p className="muted">{props.d.description}</p>}
        <div className="vc-counts">
          <span className="c-new">새 {s.today.new}</span>
          <span className="c-learn">학습 {s.today.learn}</span>
          <span className="c-rev">복습 {s.today.review}</span>
          <span className="muted">· {s.total.toLocaleString('ko-KR')}장</span>
        </div>
        <div className="vc-round-head">
          <span className="muted">{props.d.round}회독</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="muted">외움 {pct}%</span>
        </div>
      </button>
      <div className="chips">
        <button className="primary" onClick={() => props.onOpen('review')}>
          {due > 0 ? `복습 ${due}` : '복습'}
        </button>
        <button className="ghost" onClick={() => props.onOpen('round')}>
          회독
        </button>
        <button className="ghost" onClick={() => props.onOpen('quiz')}>
          퀴즈
        </button>
      </div>
    </div>
  );
}

/** 단어장: Anki 방식 간격 반복 + JLPT 회독 + 퀴즈 */
export function VocabPage(props: { onBack: () => void }) {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [open, setOpen] = useState<Deck | null>(null);
  const [tab, setTab] = useState<Tab>(() => (store.get('aura.vocabTab') as Tab) || 'review');
  const [err, setErr] = useState('');

  const load = useCallback(
    () =>
      vocab.decks().then(
        (d) => {
          setDecks(d);
          setErr('');
        },
        (e: unknown) => setErr(errMsg(e)),
      ),
    [],
  );
  useEffect(() => void load(), [load]);

  const refreshOpen = useCallback(() => {
    if (open) void vocab.deck(open.id).then(setOpen, () => undefined);
  }, [open]);

  const go = (t: Tab) => {
    setTab(t);
    store.set('aura.vocabTab', t);
  };

  const close = () => {
    setOpen(null);
    void load();
  };

  if (open)
    return (
      <div className="subpage">
        <header className="bar">
          <button className="ghost" onClick={close}>
            ← 단어장
          </button>
          <h1>{open.name}</h1>
        </header>
        <div className="subbody vc-body">
          <nav className="vc-tabs" role="tablist">
            {TABS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>
                {l}
              </button>
            ))}
          </nav>
          {open.summary.total === 0 && tab !== 'settings' && tab !== 'list' ? (
            <div className="card vc-empty">
              <h2>카드 없음</h2>
              <p>「⚙️ 설정」에서 파일을 올리거나 「📋 단어」에서 카드를 추가하세요.</p>
            </div>
          ) : (
            <>
              {tab === 'review' && <Review deck={open} onChange={setOpen} />}
              {tab === 'round' && <RoundView deck={open} onChange={refreshOpen} />}
              {tab === 'quiz' && <Quiz deck={open} onChange={() => undefined} />}
              {tab === 'list' && <CardList deck={open} onChange={refreshOpen} />}
              {tab === 'stats' && <DeckStats deck={open} />}
              {tab === 'settings' && <DeckSettings key={open.id} deck={open} onChange={setOpen} onDeleted={close} />}
            </>
          )}
          <p className="muted vc-keys">
            단축키: Space 뒤집기 · 1~4 평가 · ←/→ 모름/앎 · S 발음
          </p>
        </div>
      </div>
    );

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>단어장</h1>
      </header>
      <div className="subbody vc-body">
        <p className="muted">
          단어장 파일을 올리면 Anki처럼 잊을 때쯤 다시 보여주는 복습(간격 반복), 처음부터 끝까지 반복하는 회독, 4지선다 퀴즈로 외울 수 있어요.
        </p>
        {err && <p className="error">{err}</p>}
        {decks && decks.length > 0 && (
          <div className="vc-decks">
            {decks.map((d) => (
              <DeckCard
                key={d.id}
                d={d}
                onOpen={(t) => {
                  go(t);
                  setOpen(d);
                }}
              />
            ))}
          </div>
        )}
        {decks && decks.length === 0 && <p className="muted">아직 단어장이 없어요. 아래에서 파일을 올리거나 예시로 시작하세요.</p>}
        <section className="card">
          <h2>＋ 새 단어장 올리기</h2>
          <Importer
            onDone={(r) => {
              void load();
              go('review');
              setOpen(r.deck);
            }}
          />
        </section>
        <FormatGuide />
      </div>
    </div>
  );
}
