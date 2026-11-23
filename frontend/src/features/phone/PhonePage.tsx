import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getBackendUrl, isNative, setBackendUrl } from '../../shared/backend';
import { PcQrCard } from './PcQrCard';
import {
  parseSetupQr,
  PhoneWatch,
  type InstalledApp,
  type PhoneWatchConfig,
  type PhoneWatchStatus,
} from './phoneWatch';
import { QrScanner } from './QrScanner';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 백엔드 /health 5초 안에 응답하면 true */
async function ping(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** 폰 감시: PC에서는 연결 QR, Android 앱에서는 설정 마법사 */
export function PhonePage(props: { onBack: () => void }) {
  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>폰 감시</h1>
      </header>
      <div className="subbody">{isNative() ? <PhoneSetup /> : <PcSide />}</div>
    </div>
  );
}

function PcSide() {
  return (
    <>
      <section className="card">
        <h2>폰에서 딴짓 앱 감지 (Android)</h2>
        <p className="muted">
          PC 공부 감시 중 폰에서 유튜브·인스타 등을 열면 폰에 알림 + 통계 기록. 폰에 AURA 앱 설치 후 아래 QR 찍으면 연결 끝. 설치
          방법은 README 9-1.
        </p>
      </section>
      <PcQrCard />
    </>
  );
}

type StepId = 'connect' | 'usage' | 'notif' | 'battery' | 'start';

function PhoneSetup() {
  const [url, setUrl] = useState(getBackendUrl);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [status, setStatus] = useState<PhoneWatchStatus | null>(null);
  const [config, setConfig] = useState<PhoneWatchConfig | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState(false);
  const [editApps, setEditApps] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(() => {
    PhoneWatch.status().then(setStatus, () => undefined);
  }, []);

  const connect = useCallback(async (raw: string) => {
    const u = raw.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/\S+$/.test(u)) {
      setMsg({ ok: false, text: 'http:// 로 시작하는 주소 필요. 예: http://100.64.0.5:3000' });
      return;
    }
    setUrl(u);
    setBackendUrl(u);
    setConfig(await PhoneWatch.setConfig({ backendUrl: u }));
    setConnected(null);
    const ok = await ping(u);
    setConnected(ok);
    setMsg(
      ok
        ? { ok: true, text: 'PC 연결됨.' }
        : { ok: false, text: 'PC 응답 없음. PC 백엔드 켜짐, 폰·PC Tailscale 켜짐, HOST=0.0.0.0 확인.' },
    );
  }, []);

  useEffect(() => {
    PhoneWatch.getConfig().then((c) => {
      setConfig(c);
      // QR 딥링크로 네이티브에 먼저 저장된 주소 반영
      const u = c.backendUrl || getBackendUrl();
      if (u) void connect(u);
    }, (e: unknown) => setMsg({ ok: false, text: errText(e) }));
    const sub = PhoneWatch.addListener('setup', (e) => void connect(e.backendUrl));
    refresh();
    // 설정 화면 다녀온 뒤 상태 갱신
    const id = setInterval(refresh, 1500);
    return () => {
      clearInterval(id);
      void sub.then((h) => h.remove());
    };
  }, [connect, refresh]);

  const onScan = (text: string) => {
    setScanning(false);
    const u = parseSetupQr(text);
    if (u) void connect(u);
    else setMsg({ ok: false, text: 'AURA QR 아님. PC의 폰 감시 화면 QR 찍기.' });
  };

  const start = async () => {
    setMsg(null);
    try {
      await PhoneWatch.start();
      setMsg({ ok: true, text: '설정 끝. PC에서 공부 감시 시작하면 폰도 감시함.' });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
    setTimeout(refresh, 500);
  };

  const done: Record<StepId, boolean> = {
    connect: connected === true,
    usage: !!status?.usageGranted,
    notif: !!status?.notificationsGranted,
    battery: !!status?.batteryUnrestricted,
    start: !!status?.running,
  };
  const order: StepId[] = ['connect', 'usage', 'notif', 'battery', 'start'];
  const current = order.find((s) => !done[s]) ?? null;
  const count = order.filter((s) => done[s]).length;
  const samsung = status?.samsung ?? true;

  const step = (id: StepId, n: number, title: string, body: ReactNode) => (
    <li key={id} className={done[id] ? 'setup-step done' : id === current ? 'setup-step current' : 'setup-step'}>
      <h3>
        {done[id] ? '✅' : `${n}.`} {title}
      </h3>
      {!done[id] && id === current && body}
    </li>
  );

  if (!status) return <p className="muted">불러오는 중…</p>;

  return (
    <>
      <section className="card">
        <h2>{current ? `폰 설정 ${count}/5` : '🟢 설정 완료'}</h2>
        <div className="setup-progress">
          <i style={{ width: `${(count / 5) * 100}%` }} />
        </div>
        <ul className="setup-steps">
          {step(
            'connect',
            1,
            'PC 연결',
            <>
              <p className="muted">PC에서 AURA → 📱 폰 감시 → QR 띄우기.</p>
              {scanning ? (
                <QrScanner onResult={onScan} onClose={() => setScanning(false)} />
              ) : (
                <button className="primary big" onClick={() => setScanning(true)}>
                  📷 QR 스캔
                </button>
              )}
              {connected === null && url && <p className="muted">연결 확인 중… {url}</p>}
              <button className="ghost" onClick={() => setManual((v) => !v)}>
                주소 직접 입력
              </button>
              {manual && (
                <div className="chips">
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://100.x.y.z:3000"
                    inputMode="url"
                  />
                  <button className="primary" onClick={() => void connect(url)}>
                    연결
                  </button>
                </div>
              )}
            </>,
          )}
          {step(
            'usage',
            2,
            '사용 정보 접근 허용',
            <>
              <p className="muted">
                지금 켜진 앱 이름 확인용. 버튼 → <b>AURA</b> → <b>사용 정보 접근 허용</b> 켜기 → 뒤로.
              </p>
              <button className="primary big" onClick={() => void PhoneWatch.openUsageSettings()}>
                설정 열기
              </button>
              <details className="muted">
                <summary>"제한된 설정" 팝업이 뜨면</summary>
                <p>
                  APK로 설치하면 뜸. 아래 버튼 → 앱 정보 → 오른쪽 위 <b>⋮</b> → <b>제한된 설정 허용</b> → 다시 위 버튼.
                </p>
                <button className="ghost" onClick={() => void PhoneWatch.openAppDetails()}>
                  앱 정보 열기
                </button>
              </details>
            </>,
          )}
          {step(
            'notif',
            3,
            '알림 허용',
            <>
              <p className="muted">딴짓하면 폰에 꼽 알림. 팝업에서 허용.</p>
              <button
                className="primary big"
                onClick={() => void PhoneWatch.requestNotifications().then(refresh)}
              >
                알림 허용
              </button>
            </>,
          )}
          {step(
            'battery',
            4,
            samsung ? '배터리 제한 없음' : '배터리 최적화 제외',
            <>
              <p className="muted">
                안 하면 {samsung ? '삼성 절전이' : '절전이'} 감시를 끔. 팝업에서 <b>허용</b>.
              </p>
              <button className="primary big" onClick={() => void PhoneWatch.requestBatteryUnrestricted()}>
                허용하기
              </button>
              {samsung && (
                <details className="muted">
                  <summary>팝업 안 뜨면 (삼성)</summary>
                  <p>
                    앱 정보 → <b>배터리</b> → <b>제한 없음</b>. 같은 화면에서 <b>사용하지 않는 앱 일시정지</b> 끄기.
                  </p>
                  <button className="ghost" onClick={() => void PhoneWatch.openAppDetails()}>
                    앱 정보 열기
                  </button>
                </details>
              )}
            </>,
          )}
          {step(
            'start',
            5,
            '감시 켜기',
            <>
              <p className="muted">
                딴짓 앱 {config?.packages.length ?? 0}개 기본 선택 (유튜브·인스타·틱톡·넷플릭스 등). 상단에 "AURA 폰 감시 중"
                고정됨.
              </p>
              <button className="primary big" disabled={!done.usage} onClick={() => void start()}>
                감시 켜기
              </button>
            </>,
          )}
        </ul>
      </section>

      {!current && (
        <section className="card">
          <h2>감시</h2>
          <p>
            {status.running ? '🟢 감시 중' : '⚪ 꺼짐'}
            {config?.pcOnly && status.running && (status.live ? ' · PC 공부 중' : ' · PC 공부 시작 대기')}
          </p>
          <p className="muted">지금 앱: {status.foregroundLabel ?? '-'}</p>
          <label className="phone-check">
            <input
              type="checkbox"
              checked={config?.pcOnly ?? true}
              onChange={(e) => void PhoneWatch.setConfig({ pcOnly: e.target.checked }).then(setConfig)}
            />
            PC에서 공부 감시 켰을 때만 꼽주기
          </label>
          <div className="chips">
            <button className="ghost" onClick={() => void PhoneWatch.stop().then(() => setTimeout(refresh, 300))}>
              감시 끄기
            </button>
            <button className="ghost" onClick={() => setEditApps((v) => !v)}>
              딴짓 앱 {config?.packages.length ?? 0}개 편집
            </button>
            <button className="ghost" onClick={() => setConnected(false)}>
              PC 주소 변경
            </button>
          </div>
          <p className="muted">PC: {url}</p>
        </section>
      )}

      {editApps && config && (
        <AppPicker
          initial={config.packages}
          onSave={async (packages) => {
            const c = await PhoneWatch.setConfig({ packages });
            setConfig(c);
            setEditApps(false);
            setMsg({ ok: true, text: `딴짓 앱 ${c.packages.length}개 저장.` });
          }}
        />
      )}
      {msg && <p className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</p>}
    </>
  );
}

function AppPicker(props: { initial: string[]; onSave: (packages: string[]) => Promise<void> }) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [selected, setSelected] = useState(() => new Set(props.initial));
  const [query, setQuery] = useState('');

  useEffect(() => {
    PhoneWatch.listApps().then((r) => setApps(r.apps), () => setApps([]));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = apps ?? [];
    const hit = q ? list.filter((a) => a.label.toLowerCase().includes(q) || a.package.includes(q)) : list;
    // 선택된 앱 먼저
    return [...hit].sort((a, b) => Number(selected.has(b.package)) - Number(selected.has(a.package)));
  }, [apps, query, selected]);

  const toggle = (pkg: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(pkg)) n.delete(pkg);
      else n.add(pkg);
      return n;
    });

  return (
    <section className="card">
      <h2>딴짓 앱 ({selected.size}개)</h2>
      <label className="field">
        <span>검색</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="유튜브, 인스타…" />
      </label>
      {apps === null ? (
        <p className="muted">앱 목록 불러오는 중…</p>
      ) : (
        <ul className="phone-apps">
          {shown.map((a) => (
            <li key={a.package}>
              <label className="phone-check">
                <input type="checkbox" checked={selected.has(a.package)} onChange={() => toggle(a.package)} />
                {a.label}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="chips">
        <button className="primary" onClick={() => void props.onSave([...selected])}>
          저장
        </button>
      </div>
    </section>
  );
}
