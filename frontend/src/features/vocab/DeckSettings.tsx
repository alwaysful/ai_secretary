import { useState } from 'react';
import { Deck, vocab } from './api';
import { Importer } from './Importer';
import { download, errMsg, LANGS } from './lib';

/** 단어장 설정: 이름·언어·하루 카드 수·방향, 내보내기, 추가 업로드, 초기화, 삭제 */
export function DeckSettings(props: { deck: Deck; onChange: (d: Deck) => void; onDeleted: () => void }) {
  const d = props.deck;
  const [f, setF] = useState({
    name: d.name,
    description: d.description ?? '',
    language: d.language ?? '',
    newPerDay: d.newPerDay,
    reviewPerDay: d.reviewPerDay,
    direction: d.direction,
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<Deck | void>, ok: string) => {
    setBusy(true);
    setMsg('');
    try {
      const r = await fn();
      if (r) props.onChange(r);
      setMsg(ok);
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = (what: 'srs' | 'round' | 'all', label: string) => {
    if (window.confirm(`${label}을(를) 초기화할까요? 되돌릴 수 없습니다.`)) void run(() => vocab.reset(d.id, what), `${label} 초기화됨`);
  };

  const langs = LANGS.some(([k]) => k === f.language) ? LANGS : [...LANGS, [f.language, f.language] as [string, string]];

  return (
    <div className="vc-settings">
      <section className="card">
        <h2>단어장</h2>
        <label className="field">
          <span>이름</span>
          <input value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="field">
          <span>설명</span>
          <input value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        <label className="field">
          <span>발음 언어 (🔊 읽기)</span>
          <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>
            {langs.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
                {k ? ` (${k})` : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="vc-grid2">
          <label className="field">
            <span>하루 새 카드</span>
            <input type="number" min={0} max={9999} value={f.newPerDay} onChange={(e) => setF({ ...f, newPerDay: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
          <label className="field">
            <span>하루 복습 상한</span>
            <input type="number" min={0} max={99999} value={f.reviewPerDay} onChange={(e) => setF({ ...f, reviewPerDay: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
        </div>
        <label className="field">
          <span>카드 앞면</span>
          <span className="seg">
            <button className={f.direction === 'front' ? 'on' : ''} onClick={() => setF({ ...f, direction: 'front' })}>
              단어 → 뜻
            </button>
            <button className={f.direction === 'back' ? 'on' : ''} onClick={() => setF({ ...f, direction: 'back' })}>
              뜻 → 단어
            </button>
          </span>
        </label>
        <div className="chips">
          <button className="primary" disabled={busy || !f.name.trim()} onClick={() => void run(() => vocab.update(d.id, f), '저장됨')}>
            저장
          </button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </section>

      <section className="card">
        <h2>카드 더 넣기</h2>
        <Importer deckId={d.id} onDone={(r) => props.onChange(r.deck)} />
      </section>

      <section className="card">
        <h2>내보내기·초기화</h2>
        <div className="chips">
          <button className="ghost" onClick={() => void vocab.export(d.id).then((x) => download(`${d.name}.json`, x), (e: unknown) => setMsg(errMsg(e)))}>
            ⬇ JSON 내보내기
          </button>
          <button className="ghost danger" disabled={busy} onClick={() => reset('srs', '복습 진도')}>
            복습 진도 초기화
          </button>
          <button className="ghost danger" disabled={busy} onClick={() => reset('round', '회독 기록')}>
            회독 초기화
          </button>
          <button className="ghost danger" disabled={busy} onClick={() => reset('all', '모든 진도·통계')}>
            전부 초기화
          </button>
        </div>
        <div className="chips">
          <button
            className="primary danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`「${d.name}」 단어장과 카드 ${d.summary.total}장을 삭제할까요?`))
                void vocab.remove(d.id).then(props.onDeleted, (e: unknown) => setMsg(errMsg(e)));
            }}
          >
            단어장 삭제
          </button>
        </div>
      </section>
    </div>
  );
}
