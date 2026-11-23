/**
 * 모델 추론(생각) 텍스트 제거.
 * - <think>…</think> 블록
 * - 여는 태그 없이 "…생각…</think>답" (qwen3 thinking 템플릿)
 * - 태그 없는 영어 추론 ("Okay, the user wants…") → 한글 답 부분만
 */
const REASONING_START =
  /^\s*(<think>|okay\b|ok,|alright\b|hmm\b|so,|let me\b|let's\b|first,|the user\b|i need\b|i should\b|we need\b|wait,|well,)/i;
const HANGUL = /[가-힣]/g;

export function stripThinkText(text: string): string {
  const close = text.lastIndexOf('</think>');
  if (close >= 0) return text.slice(close + '</think>'.length).trimStart();
  text = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '');
  if (!REASONING_START.test(text)) return text.trimStart();
  return koreanTail(text);
}

/** 영어 추론 뒤 첫 한글 위주 문단부터. 없으면 원문 */
function koreanTail(text: string): string {
  const paras = text.split(/\n\s*\n/);
  const idx = paras.findIndex((p) => {
    const letters = p.replace(/[\s\d\p{P}\p{S}]/gu, '').length;
    return letters > 0 && (p.match(HANGUL)?.length ?? 0) / letters >= 0.4;
  });
  return idx > 0 ? paras.slice(idx).join('\n\n').trim() : text.trimStart();
}

/**
 * 스트림 필터. 시작이 정상이면 바로 흘려보내고,
 * 추론으로 의심되면 끝(또는 </think>)까지 모은 뒤 정리해서 내보낸다.
 */
export async function* filterThinkStream(src: AsyncIterable<string>): AsyncGenerator<string> {
  let head = '';
  let mode: 'probe' | 'pass' | 'hold' = 'probe';
  for await (const tok of src) {
    if (mode === 'pass') {
      yield tok;
      continue;
    }
    head += tok;
    if (mode === 'probe') {
      const t = head.trimStart();
      if (t.length < 12 && !t.includes('</think>') && !/[가-힣]/.test(t)) continue;
      mode = REASONING_START.test(t) || t.includes('</think>') ? 'hold' : 'pass';
      if (mode === 'pass') {
        yield head;
        head = '';
        continue;
      }
    }
    // hold: </think> 나오면 그 뒤부터 바로 흘려보냄
    const close = head.indexOf('</think>');
    if (close >= 0) {
      const rest = head.slice(close + '</think>'.length).trimStart();
      head = '';
      mode = 'pass';
      if (rest) yield rest;
    }
  }
  if (mode !== 'pass' && head) {
    const out = stripThinkText(head);
    if (out) yield out;
  }
}
