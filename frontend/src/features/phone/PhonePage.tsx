import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { getBackendUrl, isNative, setBackendUrl } from '../../shared/backend';
import { PhoneWatch, type InstalledApp, type PhoneWatchConfig, type PhoneWatchStatus } from './phoneWatch';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 폰 감시: Android 앱에서 공부 중 딴짓 앱(유튜브 등) 사용 감지 */
export function PhonePage(props: { onBack: () => void }) {
  const native = isNative();
  const [url, setUrl] = useState(getBackendUrl);
  const [status, setStatus] = useState<PhoneWatchStatus | null>(null);
  const [config, setConfig] = useState<PhoneWatchConfig | null>(null);
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(() => {
    PhoneWatch.status().then(setStatus, () => undefined);
  }, []);

  useEffect(() => {
    if (!native) return;
    PhoneWatch.getConfig().then((c) => {
      setConfig(c);
      setSelected(new Set(c.packages));
      if (!getBackendUrl() && c.backendUrl) setUrl(c.backendUrl);
    }, (e: unknown) => setMsg({ ok: false, text: errText(e) }));
    PhoneWatch.listApps().then((r) => setApps(r.apps), () => setApps([]));
    refresh();
    // 설정 화면 다녀온 뒤 권한 상태 갱신
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [native, refresh]);

  const saveUrl = async () => {
    setBackendUrl(url);
    setMsg(null);
    try {
      if (native) await PhoneWatch.setConfig({ backendUrl: url.trim().replace(/\/+$/, '') });
      const h = await api.health();
      setMsg({ ok: true, text: `연결됨. DB ${h.db}, 모델 ${h.model.state}.` });
    } catch (e) {
      setMsg({ ok: false, text: `연결 실패: ${errText(e)}` });
    }
  };

  const togglePcOnly = async (pcOnly: boolean) => setConfig(await PhoneWatch.setConfig({ pcOnly }));

  const toggleApp = (pkg: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(pkg)) n.delete(pkg);
      else n.add(pkg);
      return n;
    });

  const saveApps = async () => {
    const c = await PhoneWatch.setConfig({ packages: [...selected] });
    setConfig(c);
    setMsg({ ok: true, text: `딴짓 앱 ${c.packages.length}개 저장.` });
  };

  const startStop = async () => {
    setMsg(null);
    try {
      if (status?.running) await PhoneWatch.stop();
      else {
        if (!status?.notificationsGranted) await PhoneWatch.requestNotifications();
        await PhoneWatch.start();
      }
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
    setTimeout(refresh, 500);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = apps ?? [];
    const hit = q ? list.filter((a) => a.label.toLowerCase().includes(q) || a.package.includes(q)) : list;
    // 선택된 앱 먼저
    return [...hit].sort((a, b) => Number(selected.has(b.package)) - Number(selected.has(a.package)));
  }, [apps, query, selected]);

  const appsDirty = !!config && (config.packages.length !== selected.size || config.packages.some((p) => !selected.has(p)));

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>폰 감시</h1>
      </header>
      <div className="subbody">
        {!native && (
          <section className="card">
            <h2>Android 앱 전용</h2>
            <p className="muted">
              폰에 AURA Android 앱 설치 후 이 화면에서 켠다. 빌드 방법은 README의 "Android 앱" 참고. PC 공부 감시 중 폰에서 딴짓 앱을
              열면 폰에 알림이 오고 공부 통계에 "폰 딴짓 앱"으로 기록된다.
            </p>
          </section>
        )}

        <section className="card">
          <h2>PC 백엔드 주소</h2>
          <label className="field">
            <span>Tailscale IP 권장. 예: http://100.64.0.5:3000</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://100.x.y.z:3000" inputMode="url" />
          </label>
          <div className="chips">
            <button className="primary" disabled={!url.trim()} onClick={() => void saveUrl()}>
              저장 + 연결 확인
            </button>
          </div>
        </section>

        {native && status && (
          <>
            <section className="card">
              <h2>권한</h2>
              <ul className="phone-perms">
                <li>
                  사용 정보 접근: {status.usageGranted ? '✅ 허용' : '❌ 필요'}{' '}
                  {!status.usageGranted && (
                    <button className="ghost" onClick={() => void PhoneWatch.openUsageSettings()}>
                      설정 열기 → AURA 허용
                    </button>
                  )}
                </li>
                <li>
                  알림: {status.notificationsGranted ? '✅ 허용' : '❌ 필요'}{' '}
                  {!status.notificationsGranted && (
                    <button className="ghost" onClick={() => void PhoneWatch.requestNotifications().then(refresh)}>
                      허용
                    </button>
                  )}
                </li>
                <li>
                  배터리 최적화 제외 (권장){' '}
                  <button className="ghost" onClick={() => void PhoneWatch.openBatterySettings()}>
                    설정 열기
                  </button>
                </li>
              </ul>
            </section>

            <section className="card">
              <h2>감시</h2>
              <p>
                {status.running ? '🟢 감시 중' : '⚪ 꺼짐'}
                {config?.pcOnly && status.running && (status.live ? ' · PC 공부 세션 진행 중' : ' · PC 공부 세션 대기')}
              </p>
              <p className="muted">지금 앱: {status.foregroundLabel ?? '-'}</p>
              <label className="phone-check">
                <input type="checkbox" checked={config?.pcOnly ?? true} onChange={(e) => void togglePcOnly(e.target.checked)} />
                PC에서 공부 감시 켰을 때만 꼽주기
              </label>
              <div className="chips">
                <button className="primary" disabled={!status.usageGranted} onClick={() => void startStop()}>
                  {status.running ? '감시 끄기' : '감시 켜기'}
                </button>
              </div>
            </section>

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
                        <input type="checkbox" checked={selected.has(a.package)} onChange={() => toggleApp(a.package)} />
                        {a.label} <small className="muted">{a.package}</small>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <div className="chips">
                <button className="primary" disabled={!appsDirty} onClick={() => void saveApps()}>
                  저장
                </button>
              </div>
            </section>
          </>
        )}
        {msg && <p className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</p>}
      </div>
    </div>
  );
}
