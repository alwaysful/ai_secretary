import { useRef, useState } from 'react';
import { ImportResult, vocab } from './api';
import { download, errMsg, readFile, SAMPLE } from './lib';

/** 파일 끌어놓기·선택 → 업로드. deckId 있으면 그 단어장에 추가 */
export function Importer(props: { deckId?: string; onDone: (r: ImportResult) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; errors?: string[] } | null>(null);

  const send = async (data: unknown) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await vocab.import(data, props.deckId ? { deckId: props.deckId } : {});
      setMsg({
        ok: true,
        text: `${r.added}장 추가${r.duplicates ? ` · 중복 ${r.duplicates} 건너뜀` : ''}${r.skipped ? ` · 오류 ${r.skipped} 건너뜀` : ''}`,
        errors: r.errors,
      });
      props.onDone(r);
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const files = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    if (f.size > 30 * 1024 * 1024) return setMsg({ ok: false, text: '파일이 너무 큼 (30MB 이하)' });
    try {
      await send(await readFile(f));
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    }
  };

  return (
    <div className="vc-import">
      <div
        className={`vc-drop${drag ? ' on' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void files(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        role="button"
      >
        <b>{busy ? '⏳ 올리는 중…' : '📂 단어장 파일 끌어놓기 또는 클릭'}</b>
        <span className="muted">.json (aura-vocab 양식) · .txt/.tsv/.csv (단어, 뜻, 읽기, 예문, 예문뜻)</span>
        <input
          ref={input}
          type="file"
          accept=".json,.txt,.tsv,.csv,application/json,text/plain"
          hidden
          onChange={(e) => {
            void files(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {!props.deckId && (
        <div className="chips">
          <button className="ghost" onClick={() => download('aura-vocab-예시.json', SAMPLE)}>
            ⬇ 예시 파일 받기
          </button>
          <button className="ghost" disabled={busy} onClick={() => void send(SAMPLE)}>
            ▶ 예시로 바로 시작
          </button>
        </div>
      )}
      {msg && (
        <div className={msg.ok ? 'ok-text' : 'error'}>
          {msg.text}
          {msg.errors && msg.errors.length > 0 && (
            <details>
              <summary className="muted">건너뛴 줄 {msg.errors.length}</summary>
              <ul>
                {msg.errors.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/** 업로드 양식 설명 */
export function FormatGuide() {
  return (
    <details className="card vc-format">
      <summary>
        <b>📄 단어장 파일 양식</b> <span className="muted">(눌러서 보기)</span>
      </summary>
      <p>
        JSON 파일 하나 = 단어장 하나. <code>front</code>(단어)·<code>back</code>(뜻)만 필수.
      </p>
      <pre>{`{
  "format": "aura-vocab/1",
  "name": "JLPT N3 단어",
  "description": "선택",
  "language": "ja-JP",
  "cards": [
    {
      "front": "勉強",
      "back": "공부",
      "reading": "べんきょう",
      "example": "毎日勉強します。",
      "exampleMeaning": "매일 공부합니다.",
      "note": "메모 (선택)",
      "tags": ["N3", "명사"]
    }
  ]
}`}</pre>
      <ul className="info-list">
        <li>
          <code>language</code>: 🔊 발음 읽기 언어. ja-JP 일본어, en-US 영어, zh-CN 중국어 등. 없어도 됨.
        </li>
        <li>
          카드 배열만 있어도 됨: <code>[{'{'}"front":"apple","back":"사과"{'}'}]</code> 또는 <code>[["apple","사과"]]</code>.
        </li>
        <li>
          다른 이름도 인식: <code>word·term·question</code> → 단어, <code>meaning·definition·answer</code> → 뜻,{' '}
          <code>furigana·pronunciation</code> → 읽기.
        </li>
        <li>텍스트(.txt/.tsv/.csv): 한 줄에 「단어 탭 뜻 탭 읽기 탭 예문 탭 예문뜻」. Anki 「텍스트로 내보내기」 파일 그대로 가능. # 줄 무시.</li>
        <li>같은 단어장에 다시 올리면 단어·뜻이 같은 카드는 건너뜀. 최대 20,000장.</li>
      </ul>
    </details>
  );
}
