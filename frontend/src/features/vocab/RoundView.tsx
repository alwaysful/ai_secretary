import { useCallback, useEffect, useState } from 'react';
import { Deck, Round, vocab } from './api';
import { CardFace, useKeys } from './CardFace';
import { errMsg } from './lib';

/** 회독: 단어장 전체를 한 바퀴씩. 안다/모른다 표시 → 다음 회독은 전체 또는 모르는 것만 */
export function RoundView(props: { deck: Deck; onChange: () => void }) {
  const [r, setR] = useState<Round | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tally, setTally] = useState({ ok: 0, ng: 0 });

  const load = useCallback(
    (sh = shuffle) =>
      vocab.round(props.deck.id, sh).then(
        (x) => {
          setR(x);
          setI(0);
          setFlipped(false);
        },
        (e: unknown) => setErr(errMsg(e)),
      ),
    [props.deck.id, shuffle],
  );
  useEffect(() => void load(), [load]);

  const card = r?.cards[i];
  const mark = async (known: boolean) => {
    if (!card || busy || !r) return;
    setBusy(true);
    try {
      await vocab.roundAnswer(card.id, known);
      setTally((t) => (known ? { ...t, ok: t.ok + 1 } : { ...t, ng: t.ng + 1 }));
      setR({ ...r, left: r.left - 1, known: r.known + (known && !card.known ? 1 : !known && card.known ? -1 : 0) });
      setFlipped(false);
      if (i + 1 >= r.cards.length) await load();
      else setI(i + 1);
      props.onChange();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const next = async (unknownOnly: boolean) => {
    setBusy(true);
    try {
      const x = await vocab.nextRound(props.deck.id, unknownOnly);
      setTally({ ok: 0, ng: 0 });
      if (shuffle) await load();
      else {
        setR(x);
        setI(0);
      }
      props.onChange();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  useKeys(
    flipped
      ? { ArrowLeft: () => void mark(false), ArrowRight: () => void mark(true), '1': () => void mark(false), '2': () => void mark(true), Space: () => setFlipped(false) }
      : { Space: () => setFlipped(true), Enter: () => setFlipped(true), ArrowLeft: () => void mark(false), ArrowRight: () => void mark(true) },
    !!card,
  );

  if (err) return <p className="error">{err}</p>;
  if (!r) return <p className="muted">불러오는 중…</p>;
  const seen = r.total - r.left;
  const pct = r.total ? Math.round((seen / r.total) * 100) : 0;

  return (
    <div className="vc-study">
      <div className="vc-round-head">
        <b>{r.round}회독</b>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="muted">
          {seen}/{r.total}
        </span>
        <label className="vc-check">
          <input
            type="checkbox"
            checked={shuffle}
            onChange={(e) => {
              setShuffle(e.target.checked);
            }}
          />
          섞기
        </label>
      </div>
      <div className="vc-counts">
        <span className="c-good">외움 {r.known}</span>
        <span className="c-again">모름 {r.total - r.known}</span>
        <span className="muted">
          이번 회독 ⭕{tally.ok} ❌{tally.ng}
        </span>
      </div>
      {card ? (
        <>
          <CardFace card={card} direction={props.deck.direction} flipped={flipped} lang={props.deck.language} onFlip={() => setFlipped((f) => !f)} />
          <div className="vc-round-btns">
            <button className="vc-g again" disabled={busy} onClick={() => void mark(false)}>
              ❌ 모름 <kbd>←</kbd>
            </button>
            {!flipped && (
              <button className="ghost" onClick={() => setFlipped(true)}>
                뒤집기 <kbd>Space</kbd>
              </button>
            )}
            <button className="vc-g good" disabled={busy} onClick={() => void mark(true)}>
              ⭕ 앎 <kbd>→</kbd>
            </button>
          </div>
          {card.wrongCount > 0 && <p className="muted vc-center">지금까지 {card.wrongCount}번 틀림</p>}
        </>
      ) : (
        <div className="card vc-empty">
          <h2>🎉 {r.round}회독 완료</h2>
          <p>
            외움 {r.known} / {r.total}. 다음 회독을 시작하세요.
          </p>
          <div className="chips">
            <button className="primary" disabled={busy} onClick={() => void next(true)}>
              모르는 것만 {r.round + 1}회독 ({r.total - r.known})
            </button>
            <button className="ghost" disabled={busy} onClick={() => void next(false)}>
              전체 {r.round + 1}회독
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
