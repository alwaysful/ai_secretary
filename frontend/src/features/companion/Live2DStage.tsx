import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
    PIXI?: unknown;
  }
}

/** Cubism Core는 재배포 불가 → 로컬 파일 있으면 사용, 없으면 공식 CDN */
const CORE_URLS = ['/live2dcubismcore.min.js', 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'];
let corePromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => (window.Live2DCubismCore ? ok() : fail(new Error('core 없음')));
    s.onerror = () => {
      s.remove();
      fail(new Error(`불러오기 실패: ${src}`));
    };
    document.head.appendChild(s);
  });
}

function loadCore(): Promise<void> {
  if (window.Live2DCubismCore) return Promise.resolve();
  corePromise ??= (async () => {
    let last: unknown;
    for (const u of CORE_URLS) {
      try {
        return await loadScript(u);
      } catch (e) {
        last = e;
      }
    }
    corePromise = null;
    throw last instanceof Error ? new Error(`Live2D Cubism Core 로드 실패 (인터넷 확인). ${last.message}`) : last;
  })();
  return corePromise;
}

type Model = {
  width: number;
  height: number;
  scale: { set: (v: number) => void };
  anchor: { set: (x: number, y: number) => void };
  position: { set: (x: number, y: number) => void };
  internalModel: {
    coreModel: { setParameterValueById?: (id: string, v: number) => void };
    on: (ev: string, fn: () => void) => void;
    settings: { expressions?: { Name?: string; name?: string }[] };
  };
  expression: (id?: string | number) => Promise<boolean>;
  motion: (group: string) => Promise<boolean>;
  destroy: () => void;
};

/** 감정 → 표정 이름 후보 (모델마다 다름) */
const EXPR: Record<string, string[]> = {
  happy: ['happy', 'smile', 'joy', 'f01', 'exp_01'],
  sad: ['sad', 'cry', 'f03'],
  angry: ['angry', 'mad', 'f02'],
  calm: ['calm', 'normal', 'neutral'],
  excited: ['excited', 'surprise', 'blush', 'love'],
  tender: ['tender', 'blush', 'smile', 'love'],
  neutral: ['neutral', 'normal', 'default', 'f00'],
};

/** Live2D 캐릭터 (pixi-live2d-display, Cubism 3+). speaking 동안 입 움직임 */
export function Live2DStage(props: { url: string; speaking: boolean; emotion: string; onError?: (msg: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<Model | null>(null);
  const mouth = useRef({ speaking: false, level: 0 });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');

  mouth.current.speaking = props.speaking;

  // 서버 TTS 오디오 음량으로 입 크기
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let raf = 0;
    const onTts = (e: Event) => {
      const audio = (e as CustomEvent<{ audio: HTMLAudioElement | null }>).detail?.audio;
      cancelAnimationFrame(raf);
      if (!audio) return;
      try {
        ctx ??= new AudioContext();
        const src = ctx.createMediaElementSource(audio);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        an.connect(ctx.destination);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          mouth.current.level = Math.min(1, Math.sqrt(sum / buf.length) * 5);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* 이미 연결된 요소 등: 기본 입 움직임 사용 */
      }
    };
    window.addEventListener('aura-tts', onTts);
    return () => {
      window.removeEventListener('aura-tts', onTts);
      cancelAnimationFrame(raf);
      void ctx?.close();
    };
  }, []);

  useEffect(() => {
    let dead = false;
    let app: { destroy: (a?: boolean, b?: unknown) => void; stage: { addChild: (m: unknown) => void }; renderer: { width: number; height: number; resolution: number } } | null = null;
    let ro: ResizeObserver | null = null;
    setState('loading');
    (async () => {
      await loadCore();
      const PIXI = await import('pixi.js');
      window.PIXI = PIXI;
      const { Live2DModel } = await import('pixi-live2d-display/cubism4');
      if (dead || !canvas.current || !box.current) return;
      const a = new PIXI.Application({ view: canvas.current, resizeTo: box.current, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
      app = a as unknown as typeof app;
      const model = (await Live2DModel.from(props.url, { autoInteract: false })) as unknown as Model;
      if (dead) return model.destroy();
      modelRef.current = model;
      a.stage.addChild(model as never);
      // scale 1일 때 원래 크기
      const nw = model.width || 1;
      const nh = model.height || 1;
      const fit = () => {
        const w = box.current?.clientWidth ?? 300;
        const h = box.current?.clientHeight ?? 400;
        const s = Math.min(w / nw, h / nh) * 0.95;
        model.scale.set(s);
        model.anchor.set(0.5, 0.5);
        model.position.set(w / 2, h / 2);
      };
      fit();
      ro = new ResizeObserver(fit);
      ro.observe(box.current);
      // 입 모양: 모션 업데이트 뒤 덮어쓰기
      let t = 0;
      model.internalModel.on('beforeModelUpdate', () => {
        const m = mouth.current;
        t += 0.25;
        const v = !m.speaking ? 0 : m.level > 0.02 ? m.level : 0.35 + 0.35 * Math.abs(Math.sin(t));
        model.internalModel.coreModel.setParameterValueById?.('ParamMouthOpenY', v);
        if (!m.speaking) m.level = 0;
      });
      setState('ready');
    })().catch((e: unknown) => {
      if (dead) return;
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      setState('error');
      props.onError?.(msg);
    });
    return () => {
      dead = true;
      ro?.disconnect();
      modelRef.current = null;
      try {
        app?.destroy(false, { children: true });
      } catch {
        /* 무시 */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.url]);

  // 감정 → 표정 (있으면)
  useEffect(() => {
    const m = modelRef.current;
    if (!m || state !== 'ready') return;
    const list = m.internalModel.settings.expressions ?? [];
    const names = list.map((e) => (e.Name ?? e.name ?? '').toString());
    const want = EXPR[props.emotion] ?? [];
    const hit = names.find((n) => want.some((w) => n.toLowerCase().includes(w)));
    if (hit) void m.expression(hit);
    else if (props.emotion !== 'neutral') void m.motion('TapBody').catch(() => false);
  }, [props.emotion, state]);

  return (
    <div className="l2d" ref={box}>
      <canvas ref={canvas} />
      {state === 'loading' && <p className="l2d-msg muted">모델 불러오는 중…</p>}
      {state === 'error' && <p className="l2d-msg error">{err}</p>}
    </div>
  );
}
