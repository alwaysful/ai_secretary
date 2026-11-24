import { useEffect, useState } from 'react';
import { Deck, vocab } from './api';
import { errMsg } from './lib';
import './vocab.css';

/** 설정 화면: 단어장별 하루 새 카드·복습 수 */
export function VocabSettingsCard(props: { onOpen: () => void }) {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    vocab.decks().then(setDecks, (e: unknown) => setMsg(errMsg(e)));
  }, []);

  const save = (d: Deck, p: { newPerDay?: number; reviewPerDay?: number }) =>
    vocab.update(d.id, p).then(
      (n) => {
        setDecks((l) => l?.map((x) => (x.id === n.id ? n : x)) ?? null);
        setMsg(`「${n.name}」 저장됨`);
      },
      (e: unknown) => setMsg(errMsg(e)),
    );

  return (
    <section className="card">
      <h2>📇 단어장</h2>
      <p className="muted">단어장마다 하루에 볼 새 카드 수와 복습 상한. 이름·발음 언어·초기화는 단어장 화면 「⚙️ 설정」 탭.</p>
      {decks && decks.length === 0 && <p className="muted">단어장 없음</p>}
      {decks && decks.length > 0 && (
        <table className="vc-set-table">
          <thead>
            <tr>
              <th>단어장</th>
              <th>하루 새 카드</th>
              <th>복습 상한</th>
            </tr>
          </thead>
          <tbody>
            {decks.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    defaultValue={d.newPerDay}
                    onBlur={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      if (v !== d.newPerDay) void save(d, { newPerDay: v });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={99999}
                    defaultValue={d.reviewPerDay}
                    onBlur={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      if (v !== d.reviewPerDay) void save(d, { reviewPerDay: v });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {msg && <p className="muted">{msg}</p>}
      <div className="chips">
        <button className="ghost" onClick={props.onOpen}>
          📇 단어장 열기 →
        </button>
      </div>
    </section>
  );
}
