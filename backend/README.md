# AURA backend (Phase 1)

NestJS + Prisma + PostgreSQL + Ollama. 전부 TypeScript.

## 명세서 대비 변경

- FastAPI(Python) → NestJS(TypeScript). 사유: 프로젝트 지침. 단일 언어, Prisma 타입 공유.
- Python은 미도입. 필요해지면 추론 전용 사이드카로만 추가 (예: 임베딩, llama.cpp 바인딩).
- 디렉터리: `backend/src/ai/*`에 AI 모듈 배치. 명세서의 `ai/` 최상위 폴더는 미사용.

## 실행

```bash
cd backend
cp .env.example .env
docker compose up -d            # PostgreSQL
ollama pull qwen3:4b
npm install
npx prisma migrate dev --name init
npm run start:dev
```

## 테스트

```bash
npm test    # pretest에서 prisma generate 실행
```

## API

| Method | Path | 설명 |
|---|---|---|
| GET | /health | DB, 모델 상태 |
| POST | /conversations | `{title?}` |
| GET | /conversations | 목록 |
| GET | /conversations/:id/messages | 기록 |
| POST | /conversations/:id/messages | `{content}` → 응답 |
| POST | /conversations/:id/messages/stream | SSE, `data:{"token"}` / `event: done` |

## 메모리

- 추론은 Mutex로 직렬화. 동시에 1건.
- `OLLAMA_KEEP_ALIVE=0` → 응답 후 즉시 해제. 서버 종료 시 `unload()` 호출.
- 실제 RAM 사용량은 벤치마크 필요 (미측정).
