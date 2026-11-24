import { useCallback, useEffect, useState } from 'react';
import { Deck, Round, vocab } from './api';
import { CardFace, useKeys } from './CardFace';
import { errMsg, speak } from './lib';

/**
 * 회독: 단어마다 버튼 4개 (발음 보기 · 정답 보기 · 다시 공부하기 · 알고 있음).
 * 전체를 한 번씩 보면 「다시 공부하기」 단어만 랜덤 순서로 다시 나옴. 다 외우면 끝.
 */
export function RoundView(props: { deck: Deck; onChange: () => void }) {
  const [r, setR] = useState<Round | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reading, setReading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tally, setTally] = useState({ ok: 0, ng: 0 });
  const [notice, setNotice] = useState('');

  const show = (x: Round) => {
    setR(x);
    setI(0);
    setFlipped(false);
    setReading(false);
  };

  /** 2회독부터는 서버가 항상 랜덤 순서 */
  const load = useCallback(
    () => vocab.round(props.deck.id, shuffle).then(show, (e: unknown) => setErr(errMsg(e))),
    [props.deck.id, shuffle],
  );
  useEffect(() => void load(), [load]);

  /** 한 바퀴 끝: 다시 공부할 단어 있으면 그것만 랜덤으로 이어서 */
  const finishPass = async (cur: Round) => {
    const left = cur.total - cur.known;
    if (left <= 0) {
      setR({ ...cur, left: 0, cards: [] });
      return;
    }
    await vocab.nextRound(props.deck.id, true);
    const x = await vocab.round(props.deck.id, shuffle);
    setNotice(`${cur.round}회독 끝 · 다시 공부할 ${left}개를 랜덤 순서로 이어서`);
    setTally({ ok: 0, ng: 0 });
    show(x);
  };

  const card = r?.cards[i];
  const mark = async (known: boolean) => {
    if (!card || busy || !r) return;
    setBusy(true);
    try {
      await vocab.roundAnswer(card.id, known);
      setTally((t) => (known ? { ...t, ok: t.ok + 1 } : { ...t, ng: t.ng + 1 }));
      const next: Round = { ...r, left: r.left - 1, known: r.known + (known && !card.known ? 1 : !known && card.known ? -1 : 0) };
      setFlipped(false);
      setReading(false);
      if (i + 1 < r.cards.length) {
        setR(next);
        setI(i + 1);
      } else if (next.left > 0) {
        // 남은 카드 다음 묶음
        show(await vocab.round(props.deck.id, shuffle));
      } else await finishPass(next);
      props.onChange();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  /** 처음부터 전체 다시 */
  const restart = async () => {
    setBusy(true);
    try {
      await vocab.nextRound(props.deck.id, false);
      setTally({ ok: 0, ng: 0 });
      setNotice('');
      show(await vocab.round(props.deck.id, shuffle));
      props.onChange();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const pron = () => {
    if (!card) return;
    setReading(true);
    speak(card.front, props.deck.language);
  };

  useKeys(
    {
      '1': pron,
      '2': () => setFlipped(true),
      Space: () => setFlipped((f) => !f),
      Enter: () => setFlipped(true),
      ArrowLeft: () => void mark(false),
      '3': () => void mark(false),
      ArrowRight: () => void mark(true),
      '4': () => void mark(true),
    },
    !!card,
  );

  if (err) return <p className="error">{err}</p>;
  if (!r) return <p className="muted">불러오는 중…</p>;
  const seen = r.round > 1 ? tally.ok + tally.ng : r.total - r.left;
  const passTotal = r.round > 1 ? seen + r.left : r.total;
  const pct = passTotal ? Math.round((seen / passTotal) * 100) : 0;

  return (
    <div className="vc-study">
      <div className="vc-round-head">
        <b>{r.round === 1 ? '1회독' : `${r.round}회독 · 다시 공부`}</b>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="muted">
          {seen}/{passTotal}
        </span>
        {r.round === 1 && (
          <label className="vc-check">
            <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
            섞기
          </label>
        )}
      </div>
      <div className="vc-counts">
        <span className="c-good">알고 있음 {r.known}</span>
        <span className="c-again">다시 공부 {r.total - r.known}</span>
        <span className="muted">
          이번 바퀴 ✅{tally.ok} 🔁{tally.ng}
        </span>
      </div>
      {notice && card && <p className="ok-text vc-center">{notice}</p>}
      {card ? (
        <>
          <CardFace
            card={card}
            direction={props.deck.direction}
            flipped={flipped}
            reading={reading}
            lang={props.deck.language}
            onFlip={() => setFlipped((f) => !f)}
            hint="발음 보기 · 정답 보기로 확인"
          />
          <div className="vc-round4">
            <button className="vc-g pron" disabled={busy} onClick={pron}>
              🔊 발음 보기 <kbd>1</kbd>
            </button>
            <button className="vc-g show" disabled={busy || flipped} onClick={() => setFlipped(true)}>
              👁 정답 보기 <kbd>2</kbd>
            </button>
            <button className="vc-g again" disabled={busy} onClick={() => void mark(false)}>
              🔁 다시 공부하기 <kbd>←</kbd>
            </button>
            <button className="vc-g good" disabled={busy} onClick={() => void mark(true)}>
              ✅ 알고 있음 <kbd>→</kbd>
            </button>
          </div>
          {card.wrongCount > 0 && <p className="muted vc-center">지금까지 {card.wrongCount}번 다시 공부</p>}
        </>
      ) : (
        <div className="card vc-empty">
          <h2>🎉 전부 외움</h2>
          <p>
            {r.total}개 모두 「알고 있음」. {r.round}회독까지 했어요.
          </p>
          <div className="chips">
            <button className="primary" disabled={busy} onClick={() => void restart()}>
              처음부터 전체 다시
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
