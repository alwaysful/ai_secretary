import { lazy, Suspense, useEffect, useState } from 'react';
import { Chat } from '../chat/Chat';
import { EmotionPicker } from '../../shared/TtsControls';
import { EMOTIONS, setVoiceOverride, useEmotion, useSpeaking } from '../../shared/tts';
import { api, CompanionView } from '../../shared/api';
import { apiBase } from '../../shared/backend';
import { currentToken } from '../../shared/adminToken';
import { CompanionStudio } from './CompanionStudio';
import './companion.css';

// pixi·Live2D는 무거움 → 모델 있을 때만 로드
const Live2DStage = lazy(() => import('./Live2DStage').then((m) => ({ default: m.Live2DStage })));

const AUTO_KEY = 'aura.companionAutoSpeak';
const readAuto = () => {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
};

/** 관리자 전용: 왼쪽 채팅, 오른쪽 Live2D */
export function CompanionPage(props: { onBack: () => void; onSettings: () => void; onMemory: () => void }) {
  const [auto, setAuto] = useState(readAuto);
  const [studio, setStudio] = useState(false);
  const [view, setView] = useState<CompanionView | null>(null);
  const speaking = useSpeaking();
  const [emo] = useEmotion();
  const emoInfo = EMOTIONS.find((e) => e.id === emo)!;

  useEffect(() => {
    const t = currentToken();
    if (t) api.adminCompanion(t).then(setView, () => undefined);
  }, []);

  // 이 화면에서만 여자친구 목소리
  useEffect(() => {
    const v = view?.voice;
    setVoiceOverride(v ? { engine: v.engine, model: v.model ?? null, voice: v.voice ?? null, rate: v.rate } : null);
    return () => setVoiceOverride(null);
  }, [view?.voice]);

  const toggleAuto = (v: boolean) => {
    setAuto(v);
    try {
      localStorage.setItem(AUTO_KEY, v ? '1' : '0');
    } catch {
      /* 무시 */
    }
  };

  const model = view?.models.find((m) => m.id === view.model);
  const modelUrl = model ? `${apiBase()}/live2d/${model.id}/${model.entry.split('/').map(encodeURIComponent).join('/')}` : null;

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
        <div className={`cmp-model${speaking ? ' talking' : ''}${modelUrl ? ' has-model' : ''}`} id="live2d-stage" data-emotion={emo}>
          {modelUrl ? (
            <Suspense fallback={<p className="muted">불러오는 중…</p>}>
              <Live2DStage key={modelUrl} url={modelUrl} speaking={!!speaking} emotion={emo} />
            </Suspense>
          ) : (
            <div className="cmp-placeholder">
              <span className="cmp-face" aria-hidden>
                {emoInfo.icon}
              </span>
              <strong>Live2D 모델 없음</strong>
              <small className="muted">⚙ 꾸미기 → Live2D에서 zip 업로드 · 지금 감정: {emoInfo.label}</small>
            </div>
          )}
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
            <button className={studio ? 'primary' : 'ghost'} onClick={() => setStudio((v) => !v)}>
              ⚙ 꾸미기 (모델·목소리·성격)
            </button>
            {view?.voice && <span className="muted small">🎙 {view.voice.name}</span>}
          </div>
          {studio && view && <CompanionStudio view={view} onChange={setView} onClose={() => setStudio(false)} />}
          {studio && !view && <p className="muted small">관리자 세션 확인 중… (만료면 로고 눌러 다시 로그인)</p>}
        </div>
      </aside>
    </div>
  );
}
