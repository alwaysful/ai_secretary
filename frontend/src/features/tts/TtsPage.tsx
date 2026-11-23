import { useState } from 'react';
import { EmotionPicker } from '../../shared/TtsControls';
import { ENGINE_LABEL, speak, stopSpeaking, useSpeaking, useTtsSettings } from '../../shared/tts';

const ID = 'tts-page';

/** 글 → 음성. 엔진·목소리는 설정, 감정은 여기서 */
export function TtsPage(props: { onBack: () => void; onSettings: () => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const speaking = useSpeaking() === ID;
  const cfg = useTtsSettings();

  const play = () => {
    setErr('');
    speak(ID, text).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  };

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>🔊 TTS 읽어주기</h1>
      </header>
      <div className="subbody">
        <section className="card">
          <h2>감정</h2>
          <EmotionPicker />
          <p className="muted">OpenAI(gpt-4o-mini-tts)·Gemini는 말투 연기. 브라우저·edge-tts는 속도·음높이로 흉내.</p>
        </section>
        <section className="card">
          <label className="field">
            <span>읽을 글</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={20000} placeholder="여기에 글 입력 또는 붙여넣기" />
          </label>
          <div className="chips">
            {speaking ? (
              <button className="primary danger" onClick={stopSpeaking}>
                ■ 정지
              </button>
            ) : (
              <button className="primary" onClick={play} disabled={!text.trim()}>
                ▶ 읽기
              </button>
            )}
            <button className="ghost" onClick={props.onSettings}>
              ⚙ 목소리·엔진 설정
            </button>
            <span className="muted">
              {cfg ? `${ENGINE_LABEL[cfg.engine]}${cfg.voice ? ` · ${cfg.voice}` : ''} · ${cfg.rate}x` : '설정 불러오는 중…'}
            </span>
          </div>
          {err && <p className="error">{err}</p>}
        </section>
      </div>
    </div>
  );
}
