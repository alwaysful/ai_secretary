import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  ApiError,
  Conversation,
  Health,
  Message,
  PendingAction,
  StreamHandlers,
  streamEditLast,
  streamMessage,
  streamRegenerate,
  StreamPhase,
} from './api';
import { CopyButton } from './CopyButton';
import { MailPanel } from './MailPanel';
import { Markdown } from './Markdown';
import { diagnoseError, diagnoseHealth, Diagnosis, NoticeBox, PHASE_TEXT } from './Notice';

const tmpId = () => `tmp-${crypto.randomUUID()}`;
const label = (c: Conversation) => c.title || '새 대화';

type Retry = () => Promise<void>;

export function Chat(props: { onBack: () => void; onSettings: () => void }) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<StreamPhase | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<{ d: Diagnosis; retry?: Retry } | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoaded, setHealthLoaded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [info, setInfo] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadSeq = useRef(0);
  const warmed = useRef(false);

  const modelName = health?.model.name ?? '모델';

  const loadConvs = useCallback(
    (q = query) =>
      api
        .conversations(q.trim() || undefined)
        .then(setConvs)
        .catch(() => undefined),
    [query],
  );

  // 검색어 디바운스
  useEffect(() => {
    const t = setTimeout(() => void loadConvs(query), 250);
    return () => clearTimeout(t);
  }, [query, loadConvs]);

  const pollHealth = useCallback(
    () =>
      api
        .health()
        .then((h) => {
          setHealth(h);
          // 모델이 메모리에 없으면 미리 올려 첫 응답 지연을 줄인다
          if (!warmed.current && h.model.reachable && h.model.installed !== false && h.model.loaded === false) {
            warmed.current = true;
            void api.warmup().catch(() => undefined);
          }
        })
        .catch(() => setHealth(null))
        .finally(() => setHealthLoaded(true)),
    [],
  );

  useEffect(() => {
    void pollHealth();
    const t = setInterval(() => void pollHealth(), busy ? 3_000 : 10_000);
    return () => clearInterval(t);
  }, [pollHealth, busy]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, phase]);

  // Esc: 생성 중단
  useEffect(() => {
    if (!busy) return;
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') abortRef.current?.abort();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [busy]);

  // 응답 대기 시간 표시
  useEffect(() => {
    if (!busy) return setElapsed(0);
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const showError = (e: unknown, retry?: Retry) => {
    const code = e instanceof ApiError ? e.code : 'INTERNAL';
    const msg = e instanceof Error ? e.message : String(e);
    setError({ d: diagnoseError(code, msg, modelName), retry });
    void pollHealth();
  };

  const refresh = async (id: string) => {
    const seq = loadSeq.current;
    const list = await api.messages(id);
    if (seq === loadSeq.current) setMessages(list.filter((m) => m.role !== 'SYSTEM'));
  };

  const open = async (id: string | null) => {
    abortRef.current?.abort();
    setActiveId(id);
    setError(null);
    setMenu(false);
    setEditing(null);
    setInfo('');
    setActions([]);
    ++loadSeq.current;
    if (!id) return setMessages([]);
    try {
      await refresh(id);
      setActions(await api.actions(id).catch(() => []));
    } catch (e) {
      showError(e, () => open(id));
    }
  };

  /** 스트림 공통 처리. prepare: 화면 메시지 목록 갱신, run: 실제 요청 */
  const runStream = async (
    id: string,
    prepare: (prev: Message[], aiId: string) => Message[],
    run: (h: StreamHandlers, signal: AbortSignal) => Promise<void>,
    retry: Retry,
  ) => {
    setError(null);
    setBusy(true);
    setPhase(null);
    const ac = new AbortController();
    abortRef.current = ac;
    const aiId = tmpId();
    setMessages((prev) => prepare(prev, aiId));
    try {
      await run(
        {
          onToken: (t) =>
            setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, content: m.content + t } : m))),
          onStatus: setPhase,
          onAction: (a) => setActions((prev) => [...prev.filter((x) => x.id !== a.id), a]),
        },
        ac.signal,
      );
    } catch (e) {
      if (!ac.signal.aborted) showError(e, retry);
    } finally {
      setBusy(false);
      setPhase(null);
      abortRef.current = null;
      await refresh(id).catch(() => undefined);
      void loadConvs();
    }
  };

  const aiPlaceholder = (aiId: string): Message => ({
    id: aiId,
    role: 'ASSISTANT',
    content: '',
    createdAt: new Date().toISOString(),
  });

  const send = async (text = input): Promise<void> => {
    const content = text.trim();
    if (!content || busy) return;
    setInput('');
    let id = activeId;
    try {
      if (!id) {
        const c = await api.createConversation(content.slice(0, 40));
        id = c.id;
        setActiveId(id);
        setConvs((prev) => [c, ...prev]);
      }
    } catch (e) {
      setInput(content);
      return showError(e, () => send(content));
    }
    const cid = id;
    await runStream(
      cid,
      (prev, aiId) => [
        ...prev,
        { id: tmpId(), role: 'USER', content, createdAt: new Date().toISOString() },
        aiPlaceholder(aiId),
      ],
      (h, s) => streamMessage(cid, content, h, s),
      async () => {
        // 질문이 저장됐으면 재생성, 아니면 다시 전송
        const last = (await api.messages(cid)).at(-1);
        if (last?.role === 'USER' && last.content === content) await regenerate(cid);
        else await send(content);
      },
    );
  };

  /** 마지막 사용자 메시지 뒤를 잘라낸 목록 */
  const cutAfterLastUser = (prev: Message[], replace?: string) => {
    const idx = prev.map((m) => m.role).lastIndexOf('USER');
    if (idx < 0) return prev;
    const head = prev.slice(0, idx + 1);
    if (replace !== undefined) head[idx] = { ...head[idx], content: replace };
    return head;
  };

  const regenerate = async (id = activeId): Promise<void> => {
    if (!id || busy) return;
    const cid = id;
    await runStream(
      cid,
      (prev, aiId) => [...cutAfterLastUser(prev), aiPlaceholder(aiId)],
      (h, s) => streamRegenerate(cid, h, s),
      () => regenerate(cid),
    );
  };

  const saveEdit = async (content: string) => {
    const text = content.trim();
    if (!activeId || !text || busy) return;
    setEditing(null);
    const cid = activeId;
    await runStream(
      cid,
      (prev, aiId) => [...cutAfterLastUser(prev, text), aiPlaceholder(aiId)],
      (h, s) => streamEditLast(cid, text, h, s),
      () => regenerate(cid),
    );
  };

  const rename = async () => {
    if (!renaming) return;
    const title = renaming.title.trim();
    const { id } = renaming;
    setRenaming(null);
    if (!title) return;
    try {
      const c = await api.renameConversation(id, title);
      setConvs((prev) => prev.map((x) => (x.id === id ? c : x)));
    } catch (e) {
      showError(e);
    }
  };

  const remove = async (c: Conversation) => {
    if (!window.confirm(`"${label(c)}" 대화를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await api.deleteConversation(c.id);
      setConvs((prev) => prev.filter((x) => x.id !== c.id));
      if (c.id === activeId) void open(null);
    } catch (e) {
      showError(e);
    }
  };

  const decide = async (a: PendingAction, ok: boolean) => {
    setActionBusy(a.id);
    try {
      if (ok) {
        const ev = await api.confirmAction(a.id);
        setInfo(`${a.kind === 'calendar.create' ? '등록' : '변경'} 완료: ${ev.subject}`);
      } else {
        await api.cancelAction(a.id);
      }
      setActions((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setActions((prev) => prev.filter((x) => x.id !== a.id));
      showError(e);
    } finally {
      setActionBusy(null);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const status = diagnoseHealth(health);
  const showStatusBanner = healthLoaded && (status.level === 'down' || status.level === 'warn');
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf('USER');
  const lastIdx = messages.length - 1;
  const activeConv = convs.find((c) => c.id === activeId);

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
        <input
          className="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="대화 검색 (제목·내용)"
          aria-label="대화 검색"
        />
        <nav className="convs" aria-label="대화 목록">
          {convs.map((c) =>
            renaming?.id === c.id ? (
              <input
                key={c.id}
                className="rename"
                autoFocus
                value={renaming.title}
                maxLength={200}
                onChange={(e) => setRenaming({ id: c.id, title: e.target.value })}
                onBlur={() => void rename()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void rename();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                aria-label="대화 제목"
              />
            ) : (
              <div key={c.id} className={c.id === activeId ? 'conv-row on' : 'conv-row'}>
                <button className="conv" onClick={() => void open(c.id)} title={label(c)}>
                  {label(c)}
                </button>
                <span className="conv-acts">
                  <button
                    className="icon"
                    onClick={() => setRenaming({ id: c.id, title: c.title ?? '' })}
                    aria-label="제목 수정"
                    title="제목 수정"
                  >
                    ✎
                  </button>
                  <button className="icon" onClick={() => void remove(c)} aria-label="삭제" title="삭제">
                    🗑
                  </button>
                </span>
              </div>
            ),
          )}
          {convs.length === 0 && <p className="muted">{query ? '검색 결과 없음' : '대화 없음'}</p>}
        </nav>
        <MailPanel />
        <button className="ghost" onClick={props.onSettings}>
          ⚙ 설정 (모델·프롬프트)
        </button>
        <div className="status" role="status" title={status.hint}>
          <span className={`dot ${status.level === 'ok' ? 'ok' : status.level === 'down' ? 'down' : 'warn'}`} />
          {healthLoaded ? status.title : '상태 확인 중…'}
        </div>
      </aside>

      <main className="chat">
        <header className="bar">
          <button className="ghost menu" onClick={() => setMenu((v) => !v)} aria-label="메뉴">
            ☰
          </button>
          <h1>{activeConv ? label(activeConv) : '새 대화'}</h1>
        </header>

        {showStatusBanner && <NoticeBox d={status} onRetry={() => void pollHealth()} />}
        {healthLoaded && status.level === 'info' && !busy && <NoticeBox d={status} />}

        <div className="log">
          {messages.length === 0 && (
            <div className="empty">
              <p>무엇을 도와줄까요?</p>
              <p className="muted">예: &quot;안 읽은 메일 3통 요약해줘&quot;, &quot;내일 일정 알려줘&quot;, &quot;내일 3시 회의 잡아&quot;</p>
            </div>
          )}
          {messages.map((m, i) => {
            const isUser = m.role === 'USER';
            const streamingThis = busy && i === lastIdx && !isUser;
            if (isUser && editing === m.id) {
              return <EditBox key={m.id} initial={m.content} onSave={saveEdit} onCancel={() => setEditing(null)} />;
            }
            return (
              <div key={m.id} className={isUser ? 'msg user' : 'msg ai'}>
                <div className="bubble">
                  {isUser ? (
                    <div className="plain">{m.content}</div>
                  ) : m.content ? (
                    <Markdown text={m.content} />
                  ) : streamingThis ? (
                    <div className="phase" role="status">
                      <span className="spinner" aria-hidden />
                      {phase ? PHASE_TEXT[phase] : '요청 중…'}
                      {elapsed >= 3 && <span className="muted"> · {elapsed}초</span>}
                    </div>
                  ) : null}
                  {streamingThis && m.content && phase === 'generating' && <span className="caret" aria-hidden />}
                  {m.stopped && !streamingThis && <span className="stopped-tag">중단됨</span>}
                </div>
                {streamingThis && (
                  <div className="msg-acts">
                    <button className="tool stop" onClick={() => abortRef.current?.abort()} title="Esc">
                      ■ 생성 중단 (Esc)
                    </button>
                  </div>
                )}
                {!streamingThis && m.content && (
                  <div className="msg-acts">
                    <CopyButton text={m.content} />
                    {isUser && i === lastUserIdx && !busy && !m.id.startsWith('tmp-') && (
                      <button className="tool" onClick={() => setEditing(m.id)}>
                        편집
                      </button>
                    )}
                    {!isUser && i === lastIdx && !busy && (
                      <button className="tool" onClick={() => void regenerate()}>
                        재생성
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!busy && lastIdx >= 0 && messages[lastIdx].role === 'USER' && editing !== messages[lastIdx].id && (
            <div className="msg ai">
              <button className="ghost" onClick={() => void regenerate()}>
                응답 생성
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {actions.length > 0 && (
          <div className="actions" aria-label="확인 대기">
            {actions.map((a) => (
              <div key={a.id} className="action-card">
                <div className="action-body">
                  <strong>{a.kind === 'calendar.create' ? '📅 일정 등록 확인' : '📅 일정 변경 확인'}</strong>
                  <span>{a.summary.replace(/^(등록|변경): /, '')}</span>
                </div>
                <button className="ghost" disabled={actionBusy === a.id} onClick={() => void decide(a, false)}>
                  취소
                </button>
                <button className="primary" disabled={actionBusy === a.id} onClick={() => void decide(a, true)}>
                  {actionBusy === a.id ? '처리 중…' : 'Outlook에 저장'}
                </button>
              </div>
            ))}
          </div>
        )}
        {info && <NoticeBox d={{ level: 'info', title: info, hint: '' }} onClose={() => setInfo('')} />}

        {error && (
          <NoticeBox
            d={error.d}
            onRetry={
              error.retry
                ? () => {
                    const r = error.retry!;
                    setError(null);
                    void r();
                  }
                : undefined
            }
            onClose={() => setError(null)}
          />
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
            <button className="primary danger" onClick={() => abortRef.current?.abort()} title="Esc">
              ■ 중지
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

function EditBox(props: { initial: string; onSave: (t: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(props.initial);
  return (
    <div className="msg user">
      <div className="editbox">
        <textarea
          autoFocus
          value={text}
          rows={3}
          maxLength={8000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              props.onSave(text);
            }
            if (e.key === 'Escape') props.onCancel();
          }}
          aria-label="메시지 편집"
        />
        <div className="msg-acts">
          <button className="ghost" onClick={props.onCancel}>
            취소
          </button>
          <button className="primary" onClick={() => props.onSave(text)} disabled={!text.trim()}>
            저장 후 재생성
          </button>
        </div>
      </div>
    </div>
  );
}
