import { useEffect, useState } from 'react';
import { Chat } from '../chat/Chat';
import { api } from '../../shared/api';
import { EmotionPicker } from '../../shared/TtsControls';
import { EMOTIONS, useEmotion, useSpeaking } from '../../shared/tts';
import './companion.css';

const AUTO_KEY = 'aura.companionAutoSpeak';
const readAuto = () => {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
};

/** 성격 프롬프트 편집 */
function Persona(props: { onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [def, setDef] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api.settings().then(
      (s) => {
        setText(s.companionPrompt);
        setDef(s.defaultCompanionPrompt);
      },
      (e: unknown) => setMsg(e instanceof Error ? e.message : String(e)),
    );
  }, []);
  const save = async () => {
    if (text === null) return;
    try {
      const s = await api.saveSettings({ companionPrompt: text === def ? '' : text });
      setText(s.companionPrompt);
      setMsg('저장됨. 다음 답변부터 적용.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
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
        <button className="ghost" onClick={props.onClose}>
          닫기
        </button>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}

/** 관리자 전용: 왼쪽 채팅, 오른쪽 Live2D 자리 */
export function CompanionPage(props: { onBack: () => void; onSettings: () => void; onMemory: () => void }) {
  const [auto, setAuto] = useState(readAuto);
  const [persona, setPersona] = useState(false);
  const speaking = useSpeaking();
  const [emo] = useEmotion();
  const emoInfo = EMOTIONS.find((e) => e.id === emo)!;

  const toggleAuto = (v: boolean) => {
    setAuto(v);
    try {
      localStorage.setItem(AUTO_KEY, v ? '1' : '0');
    } catch {
      /* 무시 */
    }
  };

  return (
    <div className="companion">
      <div className="cmp-chat">
        <Chat
          onBack={props.onBack}
          onSettings={props.onSettings}
          onMemory={props.onMemory}
          persona="girlfriend"
          compact
          autoSpeak={auto}
          emptyText="왔어? 오늘 하루 어땠어? 💕"
          emptyHint="편하게 말 걸어줘. 답변은 음성으로도 들려줌."
        />
      </div>
      <aside className="cmp-stage" aria-label="Live2D 캐릭터">
        <div className={`cmp-model${speaking ? ' talking' : ''}`} id="live2d-stage" data-emotion={emo}>
          <div className="cmp-placeholder">
            <span className="cmp-face" aria-hidden>
              {emoInfo.icon}
            </span>
            <strong>Live2D 모델 자리</strong>
            <small className="muted">모델 추가 예정 · 지금 감정: {emoInfo.label}</small>
          </div>
          {speaking && <span className="cmp-wave" aria-label="말하는 중" />}
        </div>
        <div className="cmp-controls card">
          <div className="field">
            <span>목소리 감정</span>
            <EmotionPicker compact />
          </div>
          <label className="switch-row">
            <input type="checkbox" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} />
            <span>답변 음성으로 듣기</span>
          </label>
          <div className="chips">
            <button className="ghost" onClick={() => setPersona((v) => !v)}>
              💕 성격 편집
            </button>
            <button className="ghost" onClick={props.onSettings}>
              ⚙ 목소리 설정
            </button>
          </div>
          {persona && <Persona onClose={() => setPersona(false)} />}
        </div>
      </aside>
    </div>
  );
}
