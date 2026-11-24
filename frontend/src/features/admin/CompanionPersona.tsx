import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { currentToken } from '../../shared/adminToken';
import '../companion/companion.css';

const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** AI 여자친구 성격·말투 편집 (관리자 전용 API) */
export function CompanionPersona(props: { onClose?: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [def, setDef] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const t = currentToken();
    if (!t) return setMsg('관리자 세션 없음');
    api.adminCompanion(t).then(
      (r) => {
        setText(r.prompt);
        setDef(r.default);
      },
      (e: unknown) => setMsg(err(e)),
    );
  }, []);
  const save = async () => {
    const t = currentToken();
    if (text === null || !t) return;
    try {
      const r = await api.adminSetCompanion(t, text === def ? '' : text);
      setText(r.prompt);
      setMsg('저장됨. 다음 답변부터 적용.');
    } catch (e) {
      setMsg(err(e));
    }
  };
  return (
    <div className="cmp-persona">
      <label className="field">
        <span>성격·말투 (시스템 프롬프트)</span>
        <textarea value={text ?? ''} disabled={text === null} rows={7} maxLength={4000} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="chips">
        <button className="ghost" onClick={() => setText(def)}>
          기본값
        </button>
        <button className="primary" disabled={!text?.trim()} onClick={() => void save()}>
          저장
        </button>
        {props.onClose && (
          <button className="ghost" onClick={props.onClose}>
            닫기
          </button>
        )}
      </div>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
