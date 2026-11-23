import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { WebShortcuts } from '../../app/WebShortcuts';
import { api, ApiError, ToolsStatus } from '../../shared/api';

const errText = (e: unknown) =>
  e instanceof ApiError && e.code === 'BACKEND_DOWN' ? '백엔드 연결 안 됨' : e instanceof Error ? e.message : String(e);

const MAX_AUDIO_MB = 28;

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('파일 읽기 실패'));
    r.readAsDataURL(blob);
  });
}

/** 긴 변 2048px 이하 JPEG로 줄임 (전송량·비전 모델 속도) */
async function shrinkImage(file: Blob, max = 2048): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('이미지 열기 실패'));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Result(props: { text: string; meta?: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(props.text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const save = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([props.text], { type: 'text/plain;charset=utf-8' }));
    a.download = `${props.name}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="tool-out">
      <textarea readOnly value={props.text || '(글자 없음)'} rows={Math.min(16, Math.max(4, props.text.split('\n').length + 1))} />
      <div className="tool-row">
        {props.meta && <small className="muted">{props.meta}</small>}
        <span style={{ flex: 1 }} />
        <button className="ghost" onClick={copy} disabled={!props.text}>
          {copied ? '복사됨' : '복사'}
        </button>
        <button className="ghost" onClick={save} disabled={!props.text}>
          .txt 저장
        </button>
      </div>
    </div>
  );
}

/** 음성 → 글자. 마이크 녹음 또는 파일 */
function SttCard(props: { status: ToolsStatus | null }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [sec, setSec] = useState(0);
  const [lang, setLang] = useState('ko');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [out, setOut] = useState<{ text: string; meta: string } | null>(null);
  const chunks = useRef<Blob[]>([]);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rec) return;
    const t0 = Date.now();
    const t = setInterval(() => setSec(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [rec]);

  useEffect(() => () => rec?.stream.getTracks().forEach((t) => t.stop()), [rec]);

  const send = async (blob: Blob, mime: string, source: 'mic' | 'file' = 'file') => {
    if (blob.size > MAX_AUDIO_MB * 1024 * 1024) {
      setErr(`파일이 너무 큼 (최대 ${MAX_AUDIO_MB}MB)`);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await api.stt(await readDataUrl(blob), mime || 'application/octet-stream', lang || undefined, source);
      setOut({ text: r.text, meta: `${r.model} · 음성 ${r.duration}초 · ${(r.ms / 1000).toFixed(1)}초 걸림 · ${r.language}` });
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const micOff = props.status?.mic === false;

  const start = async () => {
    setErr('');
    if (micOff) {
      setErr('마이크 꺼짐. 설정 → 권한에서 켜기.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('이 화면에서는 마이크 사용 불가 (https 또는 localhost 필요). 파일로 올리세요.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = r.mimeType || mime || 'audio/webm';
        void send(new Blob(chunks.current, { type }), type, 'mic');
      };
      r.start(1000);
      setSec(0);
      setRec(r);
    } catch (e) {
      setErr(`마이크 권한 실패: ${errText(e)}`);
    }
  };

  const stop = () => {
    rec?.stop();
    setRec(null);
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void send(f, f.type);
  };

  const st = props.status?.stt;
  return (
    <section className="card tool-card">
      <h2>🎙️ 음성 → 글자 (STT)</h2>
      <p className="muted">
        로컬 Whisper{st ? ` (${st.model})` : ''}. 인터넷 전송 없음. 첫 사용 때 모델 자동 다운로드.
      </p>
      {st && !st.ok && (
        <p className="err">
          STT 미설치: {st.detail}
          <br />
          PC에서 <code>python -m pip install -r pc-agent\requirements-stt.txt</code> 또는 start-aura.bat 재실행
        </p>
      )}
      <div className="tool-row">
        {rec ? (
          <button className="primary rec-on" onClick={stop}>
            ■ 정지 · {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
          </button>
        ) : (
          <button className="primary" onClick={start} disabled={busy || micOff} title={micOff ? '설정 → 권한에서 마이크 켜기' : undefined}>
            {micOff ? '🔇 마이크 꺼짐' : '● 녹음'}
          </button>
        )}
        <button className="ghost" onClick={() => file.current?.click()} disabled={busy || !!rec}>
          파일 선택
        </button>
        <input ref={file} type="file" accept="audio/*,video/*" hidden onChange={pick} />
        <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={busy || !!rec} aria-label="언어">
          <option value="ko">한국어</option>
          <option value="en">영어</option>
          <option value="ja">일본어</option>
          <option value="zh">중국어</option>
          <option value="">자동 감지</option>
        </select>
        {busy && <span className="muted">변환 중…</span>}
      </div>
      {err && <p className="err">{err}</p>}
      {out && <Result text={out.text} meta={out.meta} name="stt" />}
    </section>
  );
}

/** 이미지 → 글자. 파일·붙여넣기·드래그 */
function OcrCard(props: { status: ToolsStatus | null }) {
  const [img, setImg] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [out, setOut] = useState<{ text: string; meta: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const load = async (f: Blob | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setErr('이미지 파일만 가능');
      return;
    }
    setErr('');
    setOut(null);
    try {
      setImg(await shrinkImage(f));
    } catch (e) {
      setErr(errText(e));
    }
  };

  // Ctrl+V 로 캡처 붙여넣기
  useEffect(() => {
    const on = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      if (item) {
        e.preventDefault();
        void load(item.getAsFile());
      }
    };
    window.addEventListener('paste', on);
    return () => window.removeEventListener('paste', on);
  }, []);

  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api.ocr(img, hint.trim() || undefined);
      setOut({ text: r.text, meta: `${r.model} · ${(r.ms / 1000).toFixed(1)}초` });
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void load(e.dataTransfer.files?.[0]);
  };

  return (
    <section className="card tool-card">
      <h2>🔍 이미지 → 글자 (OCR)</h2>
      <p className="muted">로컬 비전 모델{props.status ? ` (${props.status.ocr.model})` : ''}. 손글씨·표·한글 가능.</p>
      <div
        className={`drop${drag ? ' on' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => file.current?.click()}
        role="button"
        tabIndex={0}
      >
        {img ? <img src={img} alt="OCR 대상" /> : <span className="muted">이미지 끌어놓기 · 클릭해서 선택 · Ctrl+V 붙여넣기</span>}
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void load(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="tool-row">
        <input
          className="grow"
          value={hint}
          maxLength={300}
          onChange={(e) => setHint(e.target.value)}
          placeholder="추가 지시 (선택): 예) 표만, 영어 부분만"
        />
        <button className="primary" onClick={run} disabled={!img || busy}>
          {busy ? '읽는 중…' : '글자 추출'}
        </button>
      </div>
      {err && <p className="err">{err}</p>}
      {out && <Result text={out.text} meta={out.meta} name="ocr" />}
    </section>
  );
}

export function ToolsPage(props: { onBack: () => void }) {
  const [status, setStatus] = useState<ToolsStatus | null>(null);
  useEffect(() => {
    api.toolsStatus().then(setStatus, () => setStatus(null));
  }, []);
  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>도구</h1>
      </header>
      <div className="subbody tools">
        <WebShortcuts section="tools" title="내 사이트" />
        <div className="tool-grid">
          <SttCard status={status} />
          <OcrCard status={status} />
        </div>
      </div>
    </div>
  );
}
