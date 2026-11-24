import { useState } from 'react';
import { Deck, QuizDir, QuizPool, QuizQ, vocab } from './api';
import { useKeys } from './CardFace';
import { errMsg, speak } from './lib';

const POOLS: [QuizPool, string][] = [
  ['all', '전체'],
  ['unknown', '모르는 것'],
  ['wrong', '틀린 적 있는 것'],
  ['starred', '★ 별표'],
];

/** 4지선다 퀴즈 */
export function Quiz(props: { deck: Deck; onChange: () => void }) {
  const [n, setN] = useState(20);
  const [dir, setDir] = useState<QuizDir>('fb');
  const [pool, setPool] = useState<QuizPool>('all');
  const [qs, setQs] = useState<QuizQ[] | null>(null);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [wrong, setWrong] = useState<QuizQ[]>([]);
  const [err, setErr] = useState('');

  const start = async (list?: QuizQ[]) => {
    setErr('');
    try {
      const x = list ?? (await vocab.quiz(props.deck.id, n, dir, pool));
      if (x.length === 0) throw new Error('조건에 맞는 카드가 없음');
      setQs(x);
      setI(0);
      setPick(null);
      setWrong([]);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const q = qs?.[i];
  const choose = (k: number) => {
    if (!q || pick !== null) return;
    setPick(k);
    const ok = k === q.answer;
    if (!ok) setWrong((w) => [...w, q]);
    if (dir === 'fb') speak(q.prompt, props.deck.language);
    void vocab.quizAnswer(q.cardId, ok).then(props.onChange, () => undefined);
  };
  const next = () => {
    setPick(null);
    setI((x) => x + 1);
  };

  useKeys(
    pick === null
      ? { '1': () => choose(0), '2': () => choose(1), '3': () => choose(2), '4': () => choose(3) }
      : { Enter: next, Space: next, ArrowRight: next },
    !!q,
  );

  if (!qs)
    return (
      <div className="card vc-quiz-setup">
        <h2>퀴즈 설정</h2>
        <div className="chips">
          <span className="seg">
            <button className={dir === 'fb' ? 'on' : ''} onClick={() => setDir('fb')}>
              단어 → 뜻
            </button>
            <button className={dir === 'bf' ? 'on' : ''} onClick={() => setDir('bf')}>
              뜻 → 단어
            </button>
          </span>
        </div>
        <div className="chips">
          {POOLS.map(([k, l]) => (
            <button key={k} className={`ghost${pool === k ? ' on' : ''}`} onClick={() => setPool(k)}>
              {l}
            </button>
          ))}
        </div>
        <label className="field">
          <span>문제 수</span>
          <input type="number" min={1} max={100} value={n} onChange={(e) => setN(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
        </label>
        {err && <p className="error">{err}</p>}
        <div className="chips">
          <button className="primary" onClick={() => void start()}>
            ▶ 시작
          </button>
        </div>
      </div>
    );

  if (!q) {
    const score = qs.length - wrong.length;
    return (
      <div className="card vc-empty">
        <h2>
          결과 {score} / {qs.length} ({Math.round((score / qs.length) * 100)}점)
        </h2>
        {wrong.length > 0 && (
          <ul className="vc-wrong">
            {wrong.map((w) => (
              <li key={w.cardId}>
                <b>{w.prompt}</b> → {w.choices[w.answer]}
              </li>
            ))}
          </ul>
        )}
        <div className="chips">
          {wrong.length > 0 && (
            <button className="primary" onClick={() => void start(wrong.map((w) => ({ ...w })))}>
              틀린 것 다시
            </button>
          )}
          <button className="ghost" onClick={() => void start()}>
            새 퀴즈
          </button>
          <button className="ghost" onClick={() => setQs(null)}>
            설정
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vc-study">
      <div className="vc-counts">
        <span>
          {i + 1} / {qs.length}
        </span>
        <span className="c-again">틀림 {wrong.length}</span>
      </div>
      <div className="vc-card">
        <div className="vc-q">
          <div className="vc-big" lang={dir === 'fb' ? (props.deck.language ?? undefined) : undefined}>
            {q.prompt}
          </div>
        </div>
        {pick !== null && (q.reading || q.hint) && <div className="vc-reading">{q.reading || q.hint}</div>}
      </div>
      <div className="vc-choices">
        {q.choices.map((c, k) => (
          <button
            key={k}
            className={`vc-choice${pick === null ? '' : k === q.answer ? ' right' : k === pick ? ' wrong' : ' dim'}`}
            onClick={() => choose(k)}
            disabled={pick !== null}
          >
            <kbd>{k + 1}</kbd> {c}
          </button>
        ))}
      </div>
      {pick !== null && (
        <button className="primary vc-show" onClick={next}>
          {pick === q.answer ? '⭕ 정답' : '❌ 오답'} · 다음 <kbd>Enter</kbd>
        </button>
      )}
    </div>
  );
}
