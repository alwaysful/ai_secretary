import { useEffect, useRef } from 'react';
import { isTyping } from '../../app/Shortcuts';
import type { VCard } from './api';
import { canSpeak, speak } from './lib';

/** 단축키. 입력 중엔 무시 */
export function useKeys(map: Record<string, () => void>, on = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!on) return;
    const h = (e: KeyboardEvent) => {
      if (isTyping(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key === ' ' ? 'Space' : e.key;
      const fn = ref.current[k];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [on]);
}

export function Speak(props: { text: string; lang: string | null }) {
  if (!canSpeak()) return null;
  return (
    <button
      className="ghost vc-speak"
      title="발음 듣기 (S)"
      onClick={(e) => {
        e.stopPropagation();
        speak(props.text, props.lang);
      }}
    >
      🔊
    </button>
  );
}

/** 플래시카드 한 장. direction=back 이면 뜻 → 단어 */
export function CardFace(props: { card: VCard; direction: 'front' | 'back'; flipped: boolean; lang: string | null; onFlip?: () => void }) {
  const { card: c, flipped } = props;
  const rev = props.direction === 'back';
  useKeys({ s: () => speak(c.front, props.lang), S: () => speak(c.front, props.lang) });
  return (
    <div className={`vc-card${flipped ? ' flipped' : ''}`} onClick={props.onFlip} role="button" tabIndex={-1}>
      <div className="vc-q">
        {rev ? (
          <div className="vc-big vc-mean">{c.back}</div>
        ) : (
          <div className="vc-big" lang={props.lang ?? undefined}>
            {c.front}
          </div>
        )}
        {!rev && <Speak text={c.front} lang={props.lang} />}
        {c.starred && <span className="vc-star">★</span>}
      </div>
      {flipped ? (
        <div className="vc-a">
          {rev ? (
            <div className="vc-big" lang={props.lang ?? undefined}>
              {c.front} <Speak text={c.front} lang={props.lang} />
            </div>
          ) : null}
          {c.reading && <div className="vc-reading">{c.reading}</div>}
          {!rev && <div className="vc-mean">{c.back}</div>}
          {c.example && (
            <div className="vc-ex">
              <span lang={props.lang ?? undefined}>{c.example}</span>
              <Speak text={c.example} lang={props.lang} />
              {c.exampleMeaning && <div className="muted">{c.exampleMeaning}</div>}
            </div>
          )}
          {c.note && <div className="vc-note">💡 {c.note}</div>}
          {c.tags.length > 0 && (
            <div className="vc-tags">
              {c.tags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="vc-a vc-hidden muted">탭하거나 Space 로 정답 보기</div>
      )}
    </div>
  );
}
