import { useCallback, useEffect, useState } from 'react';
import { Deck, Round, VCard, vocab } from './api';
import { CardFace, useKeys } from './CardFace';
import { errMsg } from './lib';

/**
 * 회독. 단어마다: 정답 보기 · 발음 보기(읽기 글자) → 답 본 뒤 이해 완료! · 다시 공부하기.
 * 「복습하기」: 다시 공부하기 누른 단어만 랜덤으로. 이해 완료 누르면 목록에서 빠짐.
 */
export function RoundView(props: { deck: Deck; onChange: () => void }) {
  const [mode, setMode] = useState<'pass' | 'again'>('pass');
  const [r, setR] = useState<Round | null>(null);
  const [queue, setQueue] = useState<VCard[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reading, setReading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tally, setTally] = useState({ ok: 0, ng: 0 });

  const reset = (list: VCard[]) => {
    setQueue(list);
    setI(0);
    setFlipped(false);
    setReading(false);
  };

  const loadPass = useCallback(
    () =>
      vocab.round(props.deck.id, shuffle).then(
        (x) => {
          setR(x);
          reset(x.cards);
        },
        (e: unknown) => setErr(errMsg(e)),
      ),
    [props.deck.id, shuffle],
  );

  const loadAgain = useCallback(async () => {
    const [x, a] = await Promise.all([vocab.round(props.deck.id, false), vocab.again(props.deck.id)]);
    setR({ ...x, again: a.total });
    reset(a.cards);
  }, [props.deck.id]);

  useEffect(() => {
    if (mode === 'pass') void loadPass();
    else loadAgain().catch((e: unknown) => setErr(errMsg(e)));
  }, [mode, loadPass, loadAgain]);

  const card = queue[i];

  const mark = async (known: boolean) => {
    if (!card || busy || !r) return;
    setBusy(true);
    try {
      await vocab.roundAnswer(card.id, known);
      setTally((t) => (known ? { ...t, ok: t.ok + 1 } : { ...t, ng: t.ng + 1 }));
      // 다시 공부 목록 수: 이해 완료면 빠지고, 처음 다시 공부면 늘어남
      const wasAgain = !card.known && card.roundSeen > 0;
      const again = r.again + (known ? (wasAgain ? -1 : 0) : wasAgain ? 0 : 1);
      const knownN = r.known + (known && !card.known ? 1 : !known && card.known ? -1 : 0);
      setR({ ...r, again, known: knownN, left: mode === 'pass' ? r.left - 1 : r.left });
      setFlipped(false);
      setReading(false);
      if (i + 1 < queue.length) setI(i + 1);
      else if (mode === 'pass') await loadPass();
      else await loadAgain(); // 한 바퀴 끝: 남은 다시 공부 단어 랜덤으로 다시
      props.onChange();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const nextPass = async () => {
    setBusy(true);
    try {
      await vocab.nextRound(props.deck.id, false);
      setTally({ ok: 0, ng: 0 });
      await loadPass();
      props.onChange();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const startAgain = () => {
    setTally({ ok: 0, ng: 0 });
    setMode('again');
  };

  useKeys(
    flipped
      ? { ArrowRight: () => void mark(true), ArrowLeft: () => void mark(false), Enter: () => void mark(true) }
      : { Space: () => setFlipped(true), Enter: () => setFlipped(true), r: () => setReading(true), R: () => setReading(true), ㄱ: () => setReading(true) },
    !!card,
  );

  if (err) return <p className="error">{err}</p>;
  if (!r) return <p className="muted">불러오는 중…</p>;

  const passSeen = r.total - r.left;
  const pct = mode === 'pass' ? (r.total ? Math.round((passSeen / r.total) * 100) : 0) : tally.ok + r.again ? Math.round((tally.ok / (tally.ok + r.again)) * 100) : 100;

  return (
    <div className="vc-study">
      <div className="vc-round-head">
        <b>{mode === 'pass' ? `${r.round}회독` : '🔁 복습하기'}</b>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="muted">{mode === 'pass' ? `${passSeen}/${r.total}` : `남은 ${r.again}`}</span>
        {mode === 'pass' ? (
          <>
            <label className="vc-check">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
              섞기
            </label>
            <button className="vc-again-btn" disabled={busy || r.again === 0} onClick={startAgain} title="다시 공부하기 누른 단어만">
              🔁 복습하기 {r.again}
            </button>
          </>
        ) : (
          <button className="ghost" disabled={busy} onClick={() => setMode('pass')}>
            ← 회독으로
          </button>
        )}
      </div>
      <div className="vc-counts">
        <span className="c-good">이해 완료 {r.known}</span>
        <span className="c-again">다시 공부 {r.again}</span>
        <span className="muted">
          이번 ✅{tally.ok} 🔁{tally.ng}
        </span>
      </div>
      {card ? (
        <>
          <CardFace
            card={card}
            direction={props.deck.direction}
            flipped={flipped}
            reading={reading}
            lang={props.deck.language}
            onFlip={() => setFlipped(true)}
            hint={reading ? '정답 보기로 뜻 확인' : '정답 보기 · 발음 보기'}
          />
          {flipped ? (
            <div className="vc-round2">
              <button className="vc-big-btn ok" disabled={busy} onClick={() => void mark(true)}>
                ✅ 이해 완료! <kbd>→</kbd>
              </button>
              <button className="vc-big-btn ng" disabled={busy} onClick={() => void mark(false)}>
                🔁 다시 공부하기 <kbd>←</kbd>
              </button>
            </div>
          ) : (
            <div className="vc-round2">
              <button className="vc-big-btn show" onClick={() => setFlipped(true)}>
                👁 정답 보기 <kbd>Space</kbd>
              </button>
              <button className="vc-big-btn pron" disabled={reading} onClick={() => setReading(true)}>
                🔤 발음 보기 <kbd>R</kbd>
              </button>
            </div>
          )}
          {card.wrongCount > 0 && <p className="muted vc-center">지금까지 {card.wrongCount}번 다시 공부</p>}
        </>
      ) : mode === 'again' ? (
        <div className="card vc-empty">
          <h2>🎉 복습 끝</h2>
          <p>다시 공부할 단어가 없어요.</p>
          <div className="chips">
            <button className="primary" onClick={() => setMode('pass')}>
              ← 회독으로
            </button>
          </div>
        </div>
      ) : (
        <div className="card vc-empty">
          <h2>🎉 {r.round}회독 끝</h2>
          <p>
            이해 완료 {r.known} / {r.total} · 다시 공부 {r.again}
          </p>
          <div className="chips">
            {r.again > 0 && (
              <button className="primary" disabled={busy} onClick={startAgain}>
                🔁 복습하기 ({r.again})
              </button>
            )}
            <button className={r.again > 0 ? 'ghost' : 'primary'} disabled={busy} onClick={() => void nextPass()}>
              {r.round + 1}회독 시작 (전체)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
