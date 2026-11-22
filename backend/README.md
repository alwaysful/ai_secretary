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
| GET | /mail/auth/status | Outlook 연동 상태 |
| POST | /mail/auth/start | device code 로그인 시작 → `{userCode, verificationUri, expiresIn}` |
| DELETE | /mail/auth | 연동 해제, 저장 토큰 삭제 |
| GET | /mail/messages?top=&unreadOnly= | 받은편지함 목록 |
| GET | /mail/messages/:id | 본문(텍스트) |

## 메모리

- 추론은 Mutex로 직렬화. 동시에 1건.
- `OLLAMA_KEEP_ALIVE=0` → 응답 후 즉시 해제. 서버 종료 시 `unload()` 호출.
- 실제 RAM 사용량은 벤치마크 필요 (미측정).

## Outlook 메일 (읽기 전용)

- Microsoft Graph. 위임 권한 `Mail.Read` `User.Read` `offline_access`만 요청. 전송·삭제·수정 불가.
- 인증: device code flow. 클라이언트 시크릿 없음 (공개 클라이언트).
- 리프레시 토큰은 AES-256-GCM 암호화 후 `MailAccount`에 저장. 액세스 토큰은 메모리에만 보관.
- 메일 본문은 `Message` 테이블에 저장하지 않는다. 프롬프트에만 일시 주입.
- 대화에 "메일/outlook/받은편지함" 등이 있으면 `ToolRegistry`가 받은편지함을 읽어 system 프롬프트에 주입. "안 읽은", "N개", "내용/요약" 키워드로 범위 조절. 메일 속 지시문은 데이터로만 취급하도록 지시하지만, 소형 모델에서 프롬프트 인젝션 방어 효과는 미검증.
- API 인증 없음. `HOST=127.0.0.1` 유지. 외부 노출 금지.

설정:

1. Entra ID(Azure) 앱 등록. 플랫폼 "모바일 및 데스크톱", "공개 클라이언트 흐름 허용"=예, 위임 권한 `Mail.Read` `User.Read`.
2. `.env`에 `MS_CLIENT_ID`, `TOKEN_ENC_KEY`(64자리 hex) 설정. 키 분실·변경 시 재로그인 필요.
3. `npx prisma migrate dev --name mail_account`
4. `POST /mail/auth/start` → 응답의 `verificationUri`에서 `userCode` 입력.
5. `GET /mail/auth/status`로 `connected: true` 확인.
