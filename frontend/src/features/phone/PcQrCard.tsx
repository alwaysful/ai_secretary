import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { studyApi, type PhoneSetup } from '../study/api/study';
import { setupQrText } from './phoneWatch';

/** PC 화면: 폰이 찍을 연결 QR */
export function PcQrCard() {
  const [setup, setSetup] = useState<PhoneSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [img, setImg] = useState('');

  useEffect(() => {
    studyApi.phoneSetup().then(
      (s) => {
        setSetup(s);
        setUrl(s.addresses[0]?.url ?? '');
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  useEffect(() => {
    if (!url) return setImg('');
    QRCode.toDataURL(setupQrText(url), { width: 260, margin: 2 }).then(setImg, () => setImg(''));
  }, [url]);

  const hasTailscale = setup?.addresses.some((a) => a.kind === 'tailscale');

  return (
    <section className="card">
      <h2>폰 연결 QR</h2>
      {error && <p className="error">{error}</p>}
      {setup && !setup.reachable && (
        <p className="error">
          지금은 폰에서 접속 불가. <code>backend/.env</code> 에 <code>HOST=0.0.0.0</code> 넣고 백엔드 재시작.
        </p>
      )}
      {setup && !hasTailscale && (
        <p className="muted">Tailscale 주소 없음. 같은 와이파이에서만 됨. 밖에서도 쓰려면 PC에 Tailscale 설치·로그인.</p>
      )}
      {setup && setup.addresses.length > 1 && (
        <label className="field">
          <span>주소</span>
          <select value={url} onChange={(e) => setUrl(e.target.value)}>
            {setup.addresses.map((a) => (
              <option key={a.url} value={a.url}>
                {a.url} ({a.kind === 'tailscale' ? 'Tailscale' : '와이파이'})
              </option>
            ))}
          </select>
        </label>
      )}
      {img && <img className="qr-img" src={img} alt="폰 연결 QR" />}
      {url && (
        <ol className="muted qr-steps">
          <li>폰 AURA 앱 → 폰 감시 → "QR 스캔" → 이 QR 찍기</li>
          <li>또는 삼성 카메라로 찍기 → 뜨는 링크 탭 → AURA 열림</li>
          <li>직접 입력: <code>{url}</code></li>
        </ol>
      )}
    </section>
  );
}
