/** 모델이 고르는 PC 동작. 좌표는 스크린샷(격자 포함) 픽셀 기준. */
export type PcAction =
  | { action: 'click' | 'double_click' | 'right_click' | 'move'; x: number; y: number }
  | { action: 'drag'; x: number; y: number; x2: number; y2: number }
  | { action: 'scroll'; amount: number; x?: number; y?: number }
  | { action: 'type'; text: string }
  | { action: 'key'; keys: string }
  | { action: 'wait'; seconds: number }
  | { action: 'done' | 'fail'; message: string };

export interface PcDecision {
  thought: string;
  act: PcAction;
}

const num = (v: unknown, lo: number, hi: number): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null;
};

/** 모델 출력 → 검증된 동작. 잘못되면 Error. */
export function parseDecision(text: string, w: number, h: number): PcDecision {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) throw new Error('JSON 없음');
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    throw new Error('JSON 파싱 실패');
  }
  const thought = typeof o.thought === 'string' ? o.thought.slice(0, 200) : '';
  const a = String(o.action ?? '');
  const xy = () => {
    const x = num(o.x, 0, w - 1);
    const y = num(o.y, 0, h - 1);
    if (x === null || y === null) throw new Error(`좌표 범위 밖: ${String(o.x)},${String(o.y)}`);
    return { x, y };
  };
  let act: PcAction;
  switch (a) {
    case 'click':
    case 'double_click':
    case 'right_click':
    case 'move':
      act = { action: a, ...xy() };
      break;
    case 'drag': {
      const p = xy();
      const x2 = num(o.x2, 0, w - 1);
      const y2 = num(o.y2, 0, h - 1);
      if (x2 === null || y2 === null) throw new Error('drag 끝 좌표 없음');
      act = { action: 'drag', ...p, x2, y2 };
      break;
    }
    case 'scroll': {
      const amount = num(o.amount, -30, 30) ?? -5;
      const x = num(o.x, 0, w - 1);
      const y = num(o.y, 0, h - 1);
      act = x !== null && y !== null ? { action: 'scroll', amount, x, y } : { action: 'scroll', amount };
      break;
    }
    case 'type': {
      const t = typeof o.text === 'string' ? o.text : '';
      if (!t) throw new Error('type 텍스트 없음');
      act = { action: 'type', text: t.slice(0, 500) };
      break;
    }
    case 'key': {
      const k = typeof o.keys === 'string' ? o.keys.trim().toLowerCase() : '';
      if (!/^[a-z0-9+\-_.,;'/\\[\]`= ]{1,40}$/.test(k)) throw new Error(`키 형식 오류: ${k}`);
      act = { action: 'key', keys: k };
      break;
    }
    case 'wait':
      act = { action: 'wait', seconds: num(o.seconds, 0, 10) ?? 1 };
      break;
    case 'done':
    case 'fail':
      act = { action: a, message: typeof o.message === 'string' ? o.message.slice(0, 300) : '' };
      break;
    default:
      throw new Error(`모르는 동작: ${a}`);
  }
  return { thought, act };
}

export function describe(a: PcAction): string {
  switch (a.action) {
    case 'click':
    case 'double_click':
    case 'right_click':
    case 'move':
      return `${a.action} (${a.x},${a.y})`;
    case 'drag':
      return `drag (${a.x},${a.y})→(${a.x2},${a.y2})`;
    case 'scroll':
      return `scroll ${a.amount}`;
    case 'type':
      return `type "${a.text.slice(0, 40)}"`;
    case 'key':
      return `key ${a.keys}`;
    case 'wait':
      return `wait ${a.seconds}s`;
    default:
      return `${a.action} ${a.message}`;
  }
}
