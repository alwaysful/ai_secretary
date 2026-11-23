# AURA frontend

React + Vite + TypeScript. 브라우저 채팅 UI.

## 실행

```bash
# 백엔드 먼저 (backend/README.md)
cd frontend
npm install
npm run dev     # http://127.0.0.1:5173
```

- `/api/*` → `http://127.0.0.1:3000` 프록시 (`AURA_API` 환경변수로 변경). CORS 설정 불필요.
- 빌드: `npm run build` (타입 검사 포함).
- 첫 화면은 로비(AURA 810). 기능 설명은 로비 「ℹ️ 정보」 또는 루트 `README.md`.
- 마크다운 렌더링 지원 (`shared/Markdown.tsx`).
- Android 빌드: `npm run android:sync` → `npm run android:open`. 상세는 루트 README 7번.
- 프록시는 개발 서버 전용. 배포 시 별도 리버스 프록시 필요.
