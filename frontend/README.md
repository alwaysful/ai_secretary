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
- 기능: 대화 목록/생성, SSE 스트리밍 응답, 중지, 모델/DB 상태, Outlook 연결.
- 마크다운 렌더링 없음 (순수 텍스트). 미구현.
- 프록시는 개발 서버 전용. 배포 시 별도 리버스 프록시 필요.
