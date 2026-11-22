import { useEffect, useState } from 'react';
import type { PageId } from './App';
import { api, Health } from './api';

interface Item {
  id: PageId | null;
  icon: string;
  label: string;
  hint?: string;
}

const MAIN: Item[] = [
  { id: 'schedule', icon: '📅', label: '내 일정 보기' },
  { id: 'chat', icon: '💬', label: 'AI 채팅하기' },
  { id: 'mail', icon: '✉️', label: '메일 확인', hint: '읽기 전용' },
];

const SOON: Item[] = [
  { id: null, icon: '🎙️', label: '음성', hint: '준비 중' },
  { id: null, icon: '🛠️', label: '도구', hint: '준비 중' },
  { id: null, icon: '🧠', label: '기억', hint: '준비 중' },
];

function Links(props: { items: Item[]; onNavigate: (p: PageId) => void }) {
  return (
    <div className="box">
      {props.items.map((it) => (
        <button key={it.label} className="link" disabled={it.id === null} onClick={() => it.id && props.onNavigate(it.id)}>
          <span className="ic">{it.icon}</span>
          <span className="txt">{it.label}</span>
          {it.hint && <small>{it.hint}</small>}
        </button>
      ))}
    </div>
  );
}

export function Lobby(props: { onNavigate: (p: PageId) => void }) {
  const [health, setHealth] = useState<Health | null | undefined>(undefined);

  useEffect(() => {
    const poll = () =>
      api
        .health()
        .then(setHealth)
        .catch(() => setHealth(null));
    poll();
    const t = setInterval(poll, 10_000);
    return () => clearInterval(t);
  }, []);

  const dot = health === undefined ? 'warn' : health && health.db === 'ok' ? 'ok' : health ? 'warn' : 'down';
  const status =
    health === undefined ? '확인 중' : health ? `DB ${health.db} · ${health.model.name} ${health.model.state}` : '백엔드 연결 안 됨';
  const today = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date());

  return (
    <div className="lobby-page">
      <div className="lobby-in">
        <div className="logo">A</div>
        <div className="meta">
          <span className="status">
            <span className={`dot ${dot}`} />
            {status}
          </span>
          <span>{today}</span>
        </div>
        <h1 className="title">AURA 810</h1>
        <div className="cols">
          <section>
            <h2>바로가기</h2>
            <Links items={MAIN} onNavigate={props.onNavigate} />
          </section>
          <section>
            <h2>곧 추가</h2>
            <Links items={SOON} onNavigate={props.onNavigate} />
          </section>
        </div>
      </div>
    </div>
  );
}
