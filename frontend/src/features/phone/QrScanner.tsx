import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';

/** 후면 카메라로 QR 읽기. 찾으면 onResult(text) */
export function QrScanner(props: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(props.onResult);
  done.current = props.onResult;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let alive = true;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
      const v = video.current;
      if (!alive || !v || !ctx) return;
      if (v.readyState >= 2 && v.videoWidth) {
        // 속도: 긴 변 640px로 축소
        const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
        canvas.width = Math.round(v.videoWidth * k);
        canvas.height = Math.round(v.videoHeight * k);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          done.current(code.data);
          return;
        }
      }
      timer = window.setTimeout(scan, 200);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s;
        if (!alive || !video.current) return;
        video.current.srcObject = s;
        void video.current.play();
        scan();
      })
      .catch(() => setError('카메라 권한 필요. 폰 설정 → 애플리케이션 → AURA → 권한 → 카메라 허용.'));

    return () => {
      alive = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="qr-scan">
      {error ? <p className="error">{error}</p> : <video ref={video} muted playsInline />}
      <p className="muted">PC 화면의 QR을 네모 안에 맞추기</p>
      <button className="ghost" onClick={props.onClose}>
        닫기
      </button>
    </div>
  );
}
