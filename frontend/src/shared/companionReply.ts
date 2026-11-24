import type { Emotion } from './api';

const TAG = /^\s*\[emo:([a-z]+)(?:[\s,]+love:\s*([+-]?\d+))?\s*\]\s*/i;
const IDS: Emotion[] = ['neutral', 'happy', 'sad', 'angry', 'calm', 'excited', 'tender'];

/** 답변 앞 [emo:x love:+1] 태그 분리. 스트리밍 중 덜 온 태그도 숨김 */
export function parseReply(text: string): { emotion: Emotion | null; love: number; body: string } {
  const m = TAG.exec(text);
  if (!m) {
    if (/^\s*\[(e(m(o(:[^\]]*)?)?)?)?$/i.test(text)) return { emotion: null, love: 0, body: '' };
    return { emotion: null, love: 0, body: text };
  }
  const e = m[1].toLowerCase() as Emotion;
  return { emotion: IDS.includes(e) ? e : null, love: Math.max(-3, Math.min(3, Number(m[2] ?? 0) || 0)), body: text.slice(m[0].length) };
}

export const stripTag = (text: string) => parseReply(text).body;

/** 태그 없을 때 대략 추정 (로컬 모델이 형식 안 지킬 때) */
const RULES: [Emotion, RegExp][] = [
  ['angry', /(화나|짜증|흥[!.]|열받|삐졌|미워)/],
  ['sad', /(ㅠ|ㅜ|슬퍼|속상|힘들었|아쉽|미안|울고)/],
  ['excited', /(사랑|보고\s?싶|두근|설레|💕|❤|🥰|좋아해)/],
  ['tender', /(괜찮아|토닥|고생했|수고했|걱정|푹 쉬|힘내)/],
  ['happy', /(ㅎㅎ|ㅋㅋ|좋아|신나|대박|최고|기뻐|😄|😊|!{2,})/],
  ['calm', /(천천히|차분|그렇구나|음\.\.)/],
];

export function guessEmotion(body: string): Emotion {
  for (const [e, re] of RULES) if (re.test(body)) return e;
  return 'neutral';
}
