import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, Conversation, Health, Message, streamMessage } from './api';
import { MailPanel } from './MailPanel';

const tmpId = () => `tmp-${crypto.randomUUID()}`;
const label = (c: Conversation) => c.title || '새 대화';

export function Chat(props: { onBack: () => void }) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [menu, setMenu] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadSeq = useRef(0);

  const loadConvs = useCallback(() => api.conversations().then(setConvs).catch(() => undefined), []);

  useEffect(() => {
    void loadConvs();
  }, [loadConvs]);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const open = async (id: string | null) => {
    abortRef.current?.abort();
    setActiveId(id);
    setError('');
    setMenu(false);
    const seq = ++loadSeq.current;
    if (!id) return setMessages([]);
    try {
      const list = await api.messages(id);
      if (seq === loadSeq.current) setMessages(list.filter((m) => m.role !== 'SYSTEM'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    setInput('');
    setError('');
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;
    const now = new Date().toISOString();
    const aiId = tmpId();
    let id = activeId;
    try {
      if (!id) {
        const c = await api.createConversation(content.slice(0, 40));
        id = c.id;
        setActiveId(id);
        setConvs((prev) => [c, ...prev]);
      }
      setMessages((prev) => [
        ...prev,
        { id: tmpId(), role: 'USER', content, createdAt: now },
        { id: aiId, role: 'ASSISTANT', content: '', createdAt: now },
      ]);
      await streamMessage(
        id,
        content,
        (t) => setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, content: m.content + t } : m))),
        ac.signal,
      );
    } catch (e) {
      if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
      void loadConvs();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const modelOk = health?.model.state === 'ready' || health?.model.state === 'unloaded';

  return (
    <div className="app">
      <aside className={menu ? 'side open' : 'side'}>
        <button className="ghost back" onClick={props.onBack}>
          ← 로비
        </button>
        <div className="brand">AURA</div>
        <button className="primary" onClick={() => void open(null)}>
          새 대화
        </button>
        <nav className="convs" aria-label="대화 목록">
          {convs.map((c) => (
            <button key={c.id} className={c.id === activeId ? 'conv on' : 'conv'} onClick={() => void open(c.id)}>
              {label(c)}
            </button>
          ))}
          {convs.length === 0 && <p className="muted">대화 없음</p>}
        </nav>
        <MailPanel />
        <div className="status" role="status">
          <span className={health ? (health.db === 'ok' && modelOk ? 'dot ok' : 'dot warn') : 'dot down'} />
          {health ? `DB ${health.db} · ${health.model.name} ${health.model.state}` : '백엔드 연결 안 됨'}
        </div>
      </aside>

      <main className="chat">
        <header className="bar">
          <button className="ghost menu" onClick={() => setMenu((v) => !v)} aria-label="메뉴">
            ☰
          </button>
          <h1>{activeId ? label(convs.find((c) => c.id === activeId) ?? ({ title: null } as Conversation)) : '새 대화'}</h1>
        </header>

        <div className="log">
          {messages.length === 0 && (
            <div className="empty">
              <p>무엇을 도와줄까요?</p>
              <p className="muted">예: &quot;안 읽은 메일 3통 요약해줘&quot;</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'USER' ? 'msg user' : 'msg ai'}>
              <div className="bubble">{m.content || (busy ? '…' : '')}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="error banner" role="alert">
            {error}
          </p>
        )}

        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"
            rows={2}
            maxLength={8000}
          />
          {busy ? (
            <button className="primary" onClick={() => abortRef.current?.abort()}>
              중지
            </button>
          ) : (
            <button className="primary" onClick={() => void send()} disabled={!input.trim()}>
              보내기
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
