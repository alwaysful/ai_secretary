import { useState } from 'react';
import { EMOTIONS, speak, useEmotion, useSpeaking } from './tts';

/** 감정 선택 칩 (모든 TTS 공유) */
export function EmotionPicker(props: { compact?: boolean }) {
  const [emo, setEmo] = useEmotion();
  return (
    <div className={`emo-picker${props.compact ? ' compact' : ''}`} role="radiogroup" aria-label="말투 감정">
      {EMOTIONS.map((e) => (
        <button
          key={e.id}
          role="radio"
          aria-checked={emo === e.id}
          className={emo === e.id ? 'emo on' : 'emo'}
          onClick={() => setEmo(e.id)}
          title={e.label}
        >
          <span aria-hidden>{e.icon}</span> {e.label}
        </button>
      ))}
    </div>
  );
}

/** 읽기/정지 토글 */
export function SpeakButton(props: { id: string; text: string; className?: string; label?: string }) {
  const speaking = useSpeaking();
  const [err, setErr] = useState('');
  const on = speaking === props.id;
  return (
    <button
      className={props.className ?? 'tool'}
      onClick={() => {
        setErr('');
        speak(props.id, props.text).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
      }}
      title={err || (on ? '읽기 정지' : '소리내어 읽기')}
      aria-label={on ? '읽기 정지' : '소리내어 읽기'}
    >
      {on ? '■ 정지' : err ? '⚠ 읽기' : `🔊 ${props.label ?? '읽기'}`}
    </button>
  );
}
