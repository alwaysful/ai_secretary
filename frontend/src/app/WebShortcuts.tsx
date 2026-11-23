import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError, WebShortcut } from '../shared/api';

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** 사이트의 /favicon.ico. 실패하면 첫 글자 */
function Favicon(props: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [props.url]);
  let src = '';
  try {
    src = new URL('/favicon.ico', props.url).toString();
  } catch {
    /* 잘못된 URL → 글자 */
  }
  if (!src || failed) return <span className="fav letter">{(props.title || host(props.url)).slice(0, 1).toUpperCase()}</span>;
  return <img className="fav" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

type Editing = { id: string | null; title: string; url: string };

function EditDialog(props: {
  value: Editing;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(props.value.title);
  const [url, setUrl] = useState(props.value.url);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const first = useRef<HTMLInputElement>(null);

  const close = useRef(props.onClose);
  close.current = props.onClose;

  useEffect(() => {
    first.current?.focus();
    const on = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const body = { title: title.trim(), url: url.trim() };
      if (props.value.id) await api.updateShortcut(props.value.id, body);
      else await api.createShortcut(body);
      props.onSaved();
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={props.onClose}>
      <form className="dialog sc-form" role="dialog" aria-modal="true" aria-label="바로가기" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{props.value.id ? '바로가기 수정' : '바로가기 추가'}</h2>
        <label>
          이름 <small className="muted">비우면 도메인</small>
          <input ref={first} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="네이버" />
        </label>
        <label>
          URL
          <input value={url} required maxLength={2000} onChange={(e) => setUrl(e.target.value)} placeholder="naver.com" inputMode="url" />
        </label>
        {err && <p className="err">{err}</p>}
        <div className="sc-actions">
          {props.onDelete && (
            <button type="button" className="ghost danger-text" onClick={props.onDelete} disabled={busy}>
              삭제
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="ghost" onClick={props.onClose}>
            취소
          </button>
          <button className="primary" disabled={busy || !url.trim()}>
            저장
          </button>
        </div>
      </form>
    </div>
  );
}

/** 크롬 새 탭 스타일 웹사이트 바로가기. 클릭 → 새 탭, ✎ → 수정/삭제, 드래그 → 순서 변경 */
export function WebShortcuts() {
  const [items, setItems] = useState<WebShortcut[] | null>(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const drag = useRef<string | null>(null);

  const load = () =>
    api.shortcuts().then(
      (v) => {
        setItems(v);
        setErr('');
      },
      (e: unknown) => setErr(e instanceof ApiError && e.code === 'BACKEND_DOWN' ? '백엔드 연결 안 됨' : e instanceof Error ? e.message : String(e)),
    );

  useEffect(() => {
    void load();
  }, []);

  const remove = async (s: WebShortcut) => {
    if (!window.confirm(`"${s.title}" 바로가기 삭제?`)) return;
    try {
      await api.deleteShortcut(s.id);
      setEditing(null);
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const drop = (targetId: string) => {
    const from = drag.current;
    drag.current = null;
    if (!items || !from || from === targetId) return;
    const next = items.filter((s) => s.id !== from);
    const idx = next.findIndex((s) => s.id === targetId);
    next.splice(idx, 0, items.find((s) => s.id === from)!);
    setItems(next);
    api.reorderShortcuts(next.map((s) => s.id)).then(setItems, () => void load());
  };

  return (
    <section className="websc">
      <h2>웹사이트</h2>
      {err && <p className="muted">{err}</p>}
      <div className="sc-grid">
        {items?.map((s) => (
          <div
            key={s.id}
            className="sc-tile"
            draggable
            onDragStart={() => (drag.current = s.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(s.id)}
          >
            <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.url}>
              <span className="sc-ic">
                <Favicon url={s.url} title={s.title} />
              </span>
              <span className="sc-title">{s.title}</span>
            </a>
            <button
              className="sc-edit"
              aria-label={`${s.title} 수정`}
              title="수정·삭제"
              onClick={() => setEditing({ id: s.id, title: s.title, url: s.url })}
            >
              ✎
            </button>
          </div>
        ))}
        {items && (
          <button className="sc-tile sc-add" onClick={() => setEditing({ id: null, title: '', url: '' })}>
            <span className="sc-ic">＋</span>
            <span className="sc-title">바로가기 추가</span>
          </button>
        )}
      </div>
      {editing && (
        <EditDialog
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onDelete={editing.id ? () => remove(items!.find((s) => s.id === editing.id)!) : undefined}
        />
      )}
    </section>
  );
}
