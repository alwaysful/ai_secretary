# AURA (ai_secretary)

로컬 우선 개인 AI 비서. NestJS + Prisma + PostgreSQL + Ollama. 전부 TypeScript.

GitHub에서 막 받은 사람용 가이드. 위에서부터 순서대로 따라 하면 실행됨.

## 0. 준비물 설치

| 항목 | 버전 | 확인 명령 |
|---|---|---|
| Git | 최신 | `git --version` |
| Node.js | 20 이상 | `node -v` |
| Docker Desktop | 최신 (실행 상태) | `docker --version` |
| Ollama | 최신 (실행 상태) | `ollama --version` |

- RAM 16GB 권장. 기본 모델 `qwen3:4b`.
- 디스크 여유 약 5GB.

## 1. 저장소 받기

```bash
git clone <저장소 URL> ai_secretary
cd ai_secretary
git checkout <브랜치>        # main이 아니면. 예: feature/frontend
cd backend
```

## 2. 환경 변수 파일 만들기

```bash
copy .env.example .env       # Windows CMD
cp .env.example .env         # macOS / Linux / Git Bash
```

기본값 그대로 사용 가능. 수정 불필요.

## 3. DB 실행 (PostgreSQL)

```bash
docker compose up -d
```

- Docker Desktop 실행 중이어야 함.
- 확인: `docker compose ps` → `postgres` 상태 `running`.

## 4. 모델 받기

```bash
ollama pull qwen3:4b
```

- 약 2.5GB.
- Ollama 앱 실행 중이어야 함. 안 되면 `ollama serve`.

## 5. 패키지 설치 및 DB 테이블 생성

```bash
npm install
npx prisma migrate dev
```

- 저장소의 마이그레이션을 DB에 적용함.
- 이름 입력 요청이 뜨면 `init` 입력.

## 6. 서버 실행

```bash
npm run start:dev
```

- 주소: http://127.0.0.1:3000
- 확인 (새 터미널):

```bash
curl http://127.0.0.1:3000/health
```

`"status":"ok"` 나오면 성공.

## 7. 사용해 보기

Windows CMD 기준. PowerShell은 `curl.exe` 사용.

1) 대화 생성. 응답의 `id` 복사.

```bash
curl -X POST http://127.0.0.1:3000/conversations -H "Content-Type: application/json" -d "{\"title\":\"test\"}"
```

2) 메시지 전송.

```bash
curl -X POST http://127.0.0.1:3000/conversations/<id>/messages -H "Content-Type: application/json" -d "{\"content\":\"안녕\"}"
```

- 첫 응답은 모델 적재로 수십 초 걸릴 수 있음.

## 8. 기억 저장 (선택)

저장한 내용은 이후 모든 대화에 자동 반영됨. 민감 정보(비밀번호, 토큰) 저장 금지.

```bash
curl -X POST http://127.0.0.1:3000/memories -H "Content-Type: application/json" -d "{\"kind\":\"PREFERENCE\",\"content\":\"답변은 짧게\"}"
```

| Method | Path | 설명 |
|---|---|---|
| POST | /memories | `{kind?, content}` 저장. kind: `PREFERENCE` `FACT` `PROJECT` |
| GET | /memories?kind= | 목록 |
| PATCH | /memories/:id | 수정 |
| DELETE | /memories/:id | 삭제 |

## 9. Outlook 메일 연동 (선택, 읽기 전용)

1. Entra ID(Azure)에서 앱 등록.
   - 플랫폼: 모바일 및 데스크톱
   - 공개 클라이언트 흐름 허용: 예
   - 위임 권한: `Mail.Read`, `User.Read`
2. 암호화 키 생성.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. `backend/.env`에 입력.

```
MS_CLIENT_ID=<앱 클라이언트 ID>
TOKEN_ENC_KEY=<위에서 만든 64자리 키>
```

4. 서버 재시작.
5. 로그인 시작.

```bash
curl -X POST http://127.0.0.1:3000/mail/auth/start
```

6. 응답의 `verificationUri` 접속 → `userCode` 입력.
7. 확인: `curl http://127.0.0.1:3000/mail/auth/status` → `"connected":true`.
8. 대화에서 "안 읽은 메일 3개 요약해줘" 요청.

`TOKEN_ENC_KEY` 분실·변경 시 재로그인 필요.

## 10. 테스트

```bash
npm test
```

DB, Ollama 없이 실행됨.

## 문제 해결

| 증상 | 해결 |
|---|---|
| `/health`에서 `db: "down"` | `docker compose up -d`. Docker Desktop 실행 확인. |
| 대화 시 503 | Ollama 미실행. 앱 실행 또는 `ollama serve`. |
| 대화 시 `model not pulled` | `ollama pull qwen3:4b` |
| 대화 시 504 | 모델 느림. `.env`의 `MODEL_TIMEOUT_MS` 증가. |
| `Invalid environment: ...` | `.env` 값 오류. 메시지의 변수명 확인. |
| `prisma migrate` 실패 | DB 기동 10초 대기 후 재시도. |
| 포트 3000 사용 중 | `.env`의 `PORT` 변경. |
| 메일 `NOT_CONNECTED` | 9번 로그인 재수행. |

## 주의

- API 인증 없음. `HOST=127.0.0.1` 유지. 외부 노출 금지.
- `.env`, 모델 파일, DB 파일 커밋 금지.
- 모든 도구는 읽기 전용.

## 참고 문서

- 설계 기준: `AURA_project_spec.md`
- 백엔드 상세: `backend/README.md`
