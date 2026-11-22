import { useCallback, useEffect, useState } from 'react';
import { api, Memory } from '../../shared/api';

const fmt = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

/** 장기 기억: 사용자가 직접 추가·수정·끄기·삭제. 켜진 항목만 AI 대화에 들어간다. */
export function MemoryPage(props: { onBack: () => void }) {
  const [items, setItems] = useState<Memory[] | null>(null);
  const [q, setQ] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<{ id: string; content: string; category: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (term = q) =>
      api.memories(term.trim() || undefined).then(
        (m) => {
          setItems(m);
          setError('');
        },
        (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
      ),
    [q],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    act(async () => {
      await api.createMemory({ content: content.trim(), ...(category.trim() ? { category: category.trim() } : {}) });
      setContent('');
    });

  const save = () =>
    editing &&
    act(async () => {
      await api.updateMemory(editing.id, { content: editing.content.trim(), category: editing.category.trim() });
      setEditing(null);
    });

  const remove = (m: Memory) => {
    if (window.confirm(`삭제할까요?\n\n${m.content}`)) void act(() => api.deleteMemory(m.id));
  };

  const removeAll = () => {
    if (window.confirm('모든 기억을 삭제할까요? 되돌릴 수 없습니다.')) void act(() => api.deleteAllMemories());
  };

  const on = items?.filter((m) => m.enabled).length ?? 0;

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>기억 관리</h1>
      </header>
      <div className="subbody">
        <p className="muted">
          켜진 기억만 AI 대화와 브리핑에 들어갑니다. 채팅에서 &quot;기억해: …&quot;, &quot;… 잊어줘&quot;라고 해도 확인 버튼을 눌러야
          반영됩니다.
        </p>

        <section className="card">
          <h2>새 기억</h2>
          <label className="field">
            <span>내용</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="예: 나는 오전 회의를 선호한다"
            />
          </label>
          <div className="chips">
            <input
              className="search narrow"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={50}
              placeholder="분류 (선택, 예: 취향)"
              aria-label="분류"
            />
            <button className="primary" disabled={!content.trim() || busy} onClick={() => void add()}>
              추가
            </button>
          </div>
        </section>

        <div className="chips">
          <input
            className="search grow"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="기억 검색"
            aria-label="기억 검색"
          />
          {items && items.length > 0 && !q && (
            <button className="ghost danger-text" onClick={removeAll} disabled={busy}>
              전체 삭제
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        {items === null && !error && <p className="muted">불러오는 중…</p>}
        {items?.length === 0 && <p className="muted">{q ? '검색 결과 없음.' : '저장된 기억 없음.'}</p>}
        {items && items.length > 0 && <p className="muted">총 {items.length}개 · 사용 중 {on}개</p>}

        {items?.map((m) =>
          editing?.id === m.id ? (
            <section key={m.id} className="card">
              <textarea
                className="mem-edit"
                value={editing.content}
                autoFocus
                rows={3}
                maxLength={1000}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                aria-label="기억 내용"
              />
              <div className="chips">
                <input
                  className="search narrow"
                  value={editing.category}
                  maxLength={50}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  placeholder="분류"
                  aria-label="분류"
                />
                <button className="ghost" onClick={() => setEditing(null)}>
                  취소
                </button>
                <button className="primary" disabled={!editing.content.trim() || busy} onClick={() => void save()}>
                  저장
                </button>
              </div>
            </section>
          ) : (
            <section key={m.id} className={m.enabled ? 'card mem' : 'card mem off'}>
              <div className="mem-row">
                <label className="toggle" title={m.enabled ? '사용 중 (AI에 전달)' : '꺼짐 (AI에 전달 안 함)'}>
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    disabled={busy}
                    onChange={(e) => void act(() => api.updateMemory(m.id, { enabled: e.target.checked }))}
                  />
                  <span>{m.enabled ? '사용' : '끔'}</span>
                </label>
                <p className="mem-text">
                  {m.category && <span className="tag">{m.category}</span>}
                  {m.content}
                </p>
              </div>
              <div className="mem-meta">
                <small>
                  {m.source === 'chat' ? '채팅에서 추가' : '직접 추가'} · {fmt.format(new Date(m.updatedAt))}
                </small>
                <span>
                  <button className="tool" onClick={() => setEditing({ id: m.id, content: m.content, category: m.category ?? '' })}>
                    수정
                  </button>
                  <button className="tool" onClick={() => remove(m)}>
                    삭제
                  </button>
                </span>
              </div>
            </section>
          ),
        )}
      </div>
    </div>
  );
}
