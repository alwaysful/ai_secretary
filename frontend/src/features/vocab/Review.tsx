import { useCallback, useEffect, useState } from 'react';
import { Deck, Queue, vocab } from './api';
import { CardFace, useKeys } from './CardFace';
import { errMsg, fmtIv } from './lib';

const GRADES: { g: 1 | 2 | 3 | 4; label: string; cls: string }[] = [
  { g: 1, label: '다시', cls: 'again' },
  { g: 2, label: '어려움', cls: 'hard' },
  { g: 3, label: '알맞음', cls: 'good' },
  { g: 4, label: '쉬움', cls: 'easy' },
];

/** Anki 방식 간격 반복 복습 */
export function Review(props: { deck: Deck; onChange: (d: Deck) => void }) {
  const [q, setQ] = useState<Queue | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(0);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    vocab.queue(props.deck.id).then(
      (r) => {
        setQ(r);
        setFlipped(false);
        props.onChange(r.deck);
      },
      (e: unknown) => setErr(errMsg(e)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.deck.id]);

  useEffect(load, [load]);

  // 학습 중 카드 기다리는 중이면 시계
  const waitUntil = q && q.cards.length === 0 && q.nextLearnAt ? new Date(q.nextLearnAt).getTime() : 0;
  useEffect(() => {
    if (!waitUntil) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= waitUntil) load();
    }, 1000);
    return () => clearInterval(t);
  }, [waitUntil, load]);

  const card = q?.cards[0];
  const answer = async (g: 1 | 2 | 3 | 4) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await vocab.review(card.id, g);
      setDone((n) => n + 1);
      load();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  useKeys(
    flipped
      ? { '1': () => void answer(1), '2': () => void answer(2), '3': () => void answer(3), '4': () => void answer(4), Space: () => void answer(3), Enter: () => void answer(3) }
      : { Space: () => setFlipped(true), Enter: () => setFlipped(true) },
    !!card,
  );

  if (err) return <p className="error">{err}</p>;
  if (!q) return <p className="muted">불러오는 중…</p>;
  const t = q.deck.summary.today;

  return (
    <div className="vc-study">
      <div className="vc-counts">
        <span className="c-new" title="오늘 남은 새 카드">
          새 {t.new}
        </span>
        <span className="c-learn" title="학습 중 (분 단위 반복)">
          학습 {t.learn}
        </span>
        <span className="c-rev" title="오늘 복습할 카드">
          복습 {t.review}
        </span>
        <span className="muted">이번에 {done}장</span>
      </div>
      {card ? (
        <>
          <CardFace card={card} direction={props.deck.direction} flipped={flipped} lang={props.deck.language} onFlip={() => setFlipped(true)} />
          {flipped ? (
            <div className="vc-grades">
              {GRADES.map((b, i) => (
                <button key={b.g} className={`vc-g ${b.cls}`} disabled={busy} onClick={() => void answer(b.g)}>
                  <small>{card.preview ? fmtIv(card.preview[i]) : ''}</small>
                  {b.label}
                  <kbd>{b.g}</kbd>
                </button>
              ))}
            </div>
          ) : (
            <button className="primary vc-show" onClick={() => setFlipped(true)}>
              정답 보기 <kbd>Space</kbd>
            </button>
          )}
        </>
      ) : waitUntil ? (
        <div className="card vc-empty">
          <h2>잠깐 쉬어요</h2>
          <p>학습 중 카드가 {fmtIv(Math.max(60_000, waitUntil - now))} 뒤에 다시 나와요. ({Math.max(0, Math.ceil((waitUntil - now) / 1000))}초)</p>
        </div>
      ) : (
        <div className="card vc-empty">
          <h2>🎉 오늘 복습 끝</h2>
          <p>
            오늘 새 카드 {t.doneNew}장, 복습 {t.doneReview}장. 새 카드를 더 하려면 「설정」에서 하루 새 카드 수를 늘리세요.
          </p>
          <p className="muted">회독·퀴즈로 더 연습할 수 있어요.</p>
        </div>
      )}
    </div>
  );
}
