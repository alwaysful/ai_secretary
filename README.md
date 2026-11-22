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

AI 모델 4종. 저장 위치가 다름.

| 용도 | 모델 | 받는 곳 | 저장 위치 | 크기 |
|---|---|---|---|---|
| 채팅·브리핑 (필수) | `qwen3:4b` | Ollama | Ollama가 자동 관리 (Windows `%USERPROFILE%\.ollama\models`) | 약 2.5GB |
| 공부 집중: 화면 딴짓 분석 | `gemma4:12b` | Ollama | 위와 같음 | 수 GB |
| 공부 집중: 자세·졸음 | `pose_landmarker_lite.task`, `face_landmarker.task` | Google MediaPipe | `frontend/public/models/` | 약 10MB |
| 공부 집중: 폰 감지 | `efficientdet_lite0.tflite` | Google MediaPipe | `frontend/public/models/` | 약 7MB |

### 4-1. Ollama 모델

Ollama 설치: https://ollama.com/download

```bash
ollama pull qwen3:4b
ollama pull gemma4:12b      # 공부 집중 화면 분석 쓸 때만
ollama list                 # 확인
```

- Ollama 앱 실행 중이어야 함. 안 되면 `ollama serve`.
- 폴더에 직접 넣지 말 것. `ollama pull`이 알아서 저장.
- 화면 분석 모델 바꾸기: `backend/.env`의 `STUDY_VISION_MODEL`. 이미지 입력 되는 모델만 가능.

### 4-2. MediaPipe 모델 (공부 집중)

저장소 루트(`ai_secretary/`)에서:

```bash
npm run models
```

`frontend/public/models/`에 3개 파일 생김. 수동으로 받을 경우 아래 링크를 같은 폴더에 같은 이름으로 저장.

- https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
- https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
- https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite

```
frontend/public/models/
├─ pose_landmarker_lite.task
├─ face_landmarker.task
└─ efficientdet_lite0.tflite
```

- MediaPipe 실행 파일(wasm)은 `npm install` 시 받은 패키지에서 자동 제공. 별도 다운로드 불필요.
- 모델 파일은 git에 안 올라감 (`.gitignore`).

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

## 10. Google 캘린더·할 일 연동 (선택)

Google 리마인더는 공개 API 없음 → **Google Tasks(할 일)** 로 대체. Tasks는 Google 캘린더 앱·Gmail 사이드바에도 표시됨.

1. https://console.cloud.google.com 접속 → 프로젝트 생성.
2. "API 및 서비스 > 라이브러리"에서 **Google Calendar API**, **Google Tasks API** 사용 설정.
3. "OAuth 동의 화면"(Google 인증 플랫폼)
   - 사용자 유형: 외부
   - 앱 이름·이메일 입력
   - 데이터 액세스(범위): `.../auth/calendar.events`, `.../auth/tasks` 추가
   - 대상(테스트 사용자): 본인 Gmail 추가. 게시 상태는 "테스트" 유지 가능.
4. "사용자 인증 정보 > 사용자 인증 정보 만들기 > OAuth 클라이언트 ID"
   - 애플리케이션 유형: **데스크톱 앱**
   - 생성 후 클라이언트 ID, 클라이언트 보안 비밀번호 복사.
5. `backend/.env`에 입력. `TOKEN_ENC_KEY`는 9번과 같은 키 (없으면 9번 2단계로 생성).

```
GOOGLE_CLIENT_ID=<클라이언트 ID>
GOOGLE_CLIENT_SECRET=<클라이언트 보안 비밀번호>
TOKEN_ENC_KEY=<64자리 키>
```

6. 서버 재시작 → 채팅 화면 사이드바 **"Google 캘린더·할 일 연결"** 클릭 → 새 창에서 로그인·허용 → "연결 완료" 확인.
   - "확인되지 않은 앱" 경고: 테스트 모드라 정상. "고급 > (앱 이름)(으)로 이동".
   - 리디렉션 주소 기본값 `http://127.0.0.1:3000/google/auth/callback` (데스크톱 앱 유형은 별도 등록 불필요). 포트 변경 시 자동 반영. 다른 주소 필요 시 `GOOGLE_REDIRECT_URI`.
7. 사용 예
   - "이번 주 일정 알려줘" → Outlook + Google 일정 합쳐서 조회
   - "내일 3시 회의 잡아" → 확인 버튼 → Google 캘린더에 저장 (Google 연결 시 Google 우선, 아니면 Outlook)
   - "할 일 뭐 있어?" → Google Tasks 미완료 목록
   - "내일 우유 사기 할 일 추가해줘" / "리마인더에 약 먹기 등록" → 확인 버튼 → Google Tasks에 저장
   - "내 일정" 화면: 일정 출처 표시 + 할 일 목록(체크 시 완료 처리)
   - 아침 브리핑: 오늘까지 마감인 할 일 포함

`GOOGLE_CLIENT_ID` 비우면 기능 비활성.

## 11. 테스트

```bash
npm test
```

DB, Ollama 없이 실행됨.

## 문제 해결

> Windows PowerShell에서 `npm` 실행 시 `npm.ps1 ... 스크립트를 실행할 수 없으므로` 오류 → `npm` 대신 `npm.cmd` 사용 (예: `npm.cmd install`, `npm.cmd run dev`).

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
| 공부 집중 화면 분석 503 | `ollama pull gemma4:12b` 또는 `STUDY_VISION_MODEL` 확인. |
| 공부 집중 카메라 분석 안 됨 | `frontend/public/models/`에 모델 3개 확인 (`npm run models`). |

## 주의

- API 인증 없음. `HOST=127.0.0.1` 유지. 외부 노출 금지.
- `.env`, 모델 파일, DB 파일 커밋 금지.
- 모든 도구는 읽기 전용.

## 참고 문서

- 설계 기준: `AURA_project_spec.md`
- 백엔드 상세: `backend/README.md`
