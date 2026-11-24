import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Chat } from '../chat/Chat';
import { EmotionPicker } from '../../shared/TtsControls';
import { EMOTIONS, setEmotion, setVoiceOverride, stopSpeaking, useEmotion, useSpeaking } from '../../shared/tts';
import { api, CompanionBond, CompanionView } from '../../shared/api';
import { guessEmotion, parseReply } from '../../shared/companionReply';
import { browserSttSupported, useVoiceTalk, VoiceEngine } from './useVoiceTalk';
import { apiBase } from '../../shared/backend';
import { currentToken } from '../../shared/adminToken';
import { CompanionStudio } from './CompanionStudio';
import './companion.css';

// pixi·Live2D는 무거움 → 모델 있을 때만 로드
const Live2DStage = lazy(() => import('./Live2DStage').then((m) => ({ default: m.Live2DStage })));

const AUTO_KEY = 'aura.companionAutoSpeak';
const EMO_KEY = 'aura.companionAutoEmotion';
const VOICE_KEY = 'aura.companionSttEngine';
const readFlag = (k: string) => {
  try {
    return localStorage.getItem(k) !== '0';
  } catch {
    return true;
  }
};
const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 무시 */
  }
};

const VOICE_TEXT = { off: '', wait: '답변 기다리는 중…', listening: '듣는 중… 말해줘', hearing: '말하는 중…', thinking: '알아듣는 중…' } as const;

/** 관리자 전용: 왼쪽 채팅, 오른쪽 Live2D */
export function CompanionPage(props: { onBack: () => void; onSettings: () => void; onMemory: () => void }) {
  const [auto, setAuto] = useState(() => readFlag(AUTO_KEY));
  const [autoEmo, setAutoEmo] = useState(() => readFlag(EMO_KEY));
  const [bond, setBond] = useState<CompanionBond | null>(null);
  const [delta, setDelta] = useState<{ v: number; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [talk, setTalk] = useState(false);
  const [engine, setEngine] = useState<VoiceEngine>(() => {
    try {
      return localStorage.getItem(VOICE_KEY) === 'browser' && browserSttSupported() ? 'browser' : 'server';
    } catch {
      return 'server';
    }
  });
  const [external, setExternal] = useState<{ text: string; n: number } | null>(null);
  const [resetArm, setResetArm] = useState(false);
  const [studio, setStudio] = useState(false);
  const [view, setView] = useState<CompanionView | null>(null);
  const speaking = useSpeaking();
  const [emo] = useEmotion();
  const emoInfo = EMOTIONS.find((e) => e.id === emo)!;

  useEffect(() => {
    const t = currentToken();
    if (t)
      api.adminCompanion(t).then(
        (v) => {
          setView(v);
          setBond(v.bond);
        },
        () => undefined,
      );
  }, []);

  const sendText = useCallback((text: string) => setExternal((p) => ({ text, n: (p?.n ?? 0) + 1 })), []);
  const voice = useVoiceTalk({ enabled: talk, paused: busy || !!speaking, engine, onText: sendText });

  // 답변 끝: 감정 → 목소리·표정, 호감도 갱신
  const onReply = useCallback(
    (text: string) => {
      const p = parseReply(text);
      if (autoEmo) setEmotion(p.emotion ?? guessEmotion(p.body));
      const t = currentToken();
      if (!t) return;
      api.adminBond(t).then(
        (b) => {
          setBond((old) => {
            const d = old ? b.affinity - old.affinity : 0;
            if (d) setDelta((x) => ({ v: d, n: (x?.n ?? 0) + 1 }));
            return b;
          });
        },
        () => undefined,
      );
    },
    [autoEmo],
  );

  useEffect(() => {
    if (!delta) return;
    const t = setTimeout(() => setDelta(null), 2200);
    return () => clearTimeout(t);
  }, [delta]);

  const resetBond = async () => {
    if (!resetArm) return setResetArm(true);
    setResetArm(false);
    const t = currentToken();
    if (t) setBond(await api.adminSetBond(t, 30).catch(() => bond));
  };

  // 이 화면에서만 여자친구 목소리
  useEffect(() => {
    const v = view?.voice;
    setVoiceOverride(v ? { engine: v.engine, model: v.model ?? null, voice: v.voice ?? null, rate: v.rate } : null);
    return () => setVoiceOverride(null);
  }, [view?.voice]);

  const toggleAuto = (v: boolean) => {
    setAuto(v);
    store(AUTO_KEY, v ? '1' : '0');
  };
  const toggleAutoEmo = (v: boolean) => {
    setAutoEmo(v);
    store(EMO_KEY, v ? '1' : '0');
  };
  const toggleTalk = () => {
    if (!talk) {
      stopSpeaking();
      if (!auto) toggleAuto(true); // 음성 대화는 답변도 음성으로
    }
    setTalk(!talk);
  };
  const pickEngine = (e: VoiceEngine) => {
    setEngine(e);
    store(VOICE_KEY, e);
  };
  // 현재 단계 안에서 진행률
  const base = bond ? [0, 20, 45, 70, 90][bond.index] ?? 0 : 0;
  const pct = bond ? Math.round(((bond.affinity - base) / ((bond.next?.at ?? 100) - base || 1)) * 100) : 0;

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
          autoSpeak={auto || talk}
          onReply={onReply}
          onBusy={setBusy}
          external={external}
          emptyText="왔어? 오늘 하루 어땠어? 💕"
          emptyHint="편하게 말 걸어줘. 답변은 음성으로도 들려줌."
        />
      </div>
      <aside className="cmp-stage" aria-label="Live2D 캐릭터">
        <div className={`cmp-model${speaking ? ' talking' : ''}${modelUrl ? ' has-model' : ''}`} id="live2d-stage" data-emotion={emo}>
          {modelUrl ? (
            <Suspense fallback={<p className="muted">불러오는 중…</p>}>
              <Live2DStage key={modelUrl} url={modelUrl} speaking={!!speaking} emotion={emo} onTap={() => setEmotion('happy')} />
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
          {delta && (
            <span key={delta.n} className={`cmp-delta${delta.v < 0 ? ' down' : ''}`} aria-live="polite">
              {delta.v > 0 ? `+${delta.v} 💗` : `${delta.v} 💔`}
            </span>
          )}
          {talk && (
            <span className={`cmp-mic ${voice.state}`} role="status">
              <i style={{ transform: `scale(${1 + voice.level * 1.5})` }} aria-hidden />
              🎙 {VOICE_TEXT[voice.state]}
            </span>
          )}
        </div>
        {bond && (
          <div className="cmp-bond card" title={bond.tone}>
            <div className="cmp-bond-top">
              <strong>💗 {bond.name}</strong>
              <span className="muted small">
                호감도 {bond.affinity}/100{bond.next ? ` · 다음 ${bond.next.name} ${bond.next.at}` : ' · 최고 단계'}
              </span>
              <button className="ghost small" onClick={() => void resetBond()} onBlur={() => setResetArm(false)}>
                {resetArm ? '정말 초기화?' : '초기화'}
              </button>
            </div>
            <div className="cmp-bar" role="progressbar" aria-valuenow={bond.affinity} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} />
            </div>
          </div>
        )}
        <div className="cmp-controls card">
          <div className="chips">
            <button className={talk ? 'primary' : 'ghost'} onClick={toggleTalk} aria-pressed={talk}>
              {talk ? '■ 음성 대화 끄기' : '🎙 음성 대화 시작'}
            </button>
            <select value={engine} onChange={(e) => pickEngine(e.target.value as VoiceEngine)} aria-label="음성 인식 방식">
              <option value="server">인식: AURA STT (로컬 Whisper)</option>
              {browserSttSupported() && <option value="browser">인식: 브라우저 (빠름·구글 전송)</option>}
            </select>
            <button className="ghost" disabled={busy} onClick={() => sendText('(머리를 살짝 쓰다듬어 준다)')}>
              🤚 쓰다듬기
            </button>
          </div>
          {voice.error && <p className="error small">{voice.error}</p>}
          <div className="field">
            <span>목소리 감정</span>
            <EmotionPicker compact />
          </div>
          <label className="switch-row">
            <input type="checkbox" checked={autoEmo} onChange={(e) => toggleAutoEmo(e.target.checked)} />
            <span>답변 내용 따라 감정 자동 (목소리·표정)</span>
          </label>
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
