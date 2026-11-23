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

## 7-1. 공부 집중

로비 「📚 공부 집중」(단축키 8).

- 🍅 뽀모도로: 체크 켜면 감시 중 25분 집중 → 자동 5분 휴식(분석 일시정지) → 다시 집중.
- 통계: 공부 화면 하단 「통계」. 일별 7일 / 주별 8주 집중 시간, 위반 횟수(자세·핸드폰·딴짓·수면) 그래프.
- 기록은 DB `StudySession` 테이블. 감시 중 1분마다, 종료 시 저장.

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

## 9-1. Android 앱 + 폰 감시 (선택)

PC 공부 감시 중 폰에서 딴짓 앱(유튜브·인스타 등)을 열면 폰에 알림 + 공부 통계에 "폰 딴짓 앱" 기록.
화면 캡처 없이 UsageStats(지금 켜진 앱 이름)만 사용. Android 전용 (iOS 불가).

### 9-1-1. 준비물 (PC)

| 항목 | 설치 |
| --- | --- |
| Node 22 이상 | `node -v` 확인. 낮으면 [nodejs.org](https://nodejs.org) LTS 설치 |
| Android Studio | [developer.android.com/studio](https://developer.android.com/studio) 설치. 첫 실행 시 Standard 설치 → SDK 자동 설치 |
| Tailscale | PC·폰 둘 다 [tailscale.com](https://tailscale.com/download) 설치, 같은 계정 로그인 |

Android Studio 첫 실행 후: More Actions → SDK Manager → Android SDK Platform 36 체크 확인.

### 9-1-2. 백엔드 외부 접속 허용 (PC)

1. `backend/.env` 수정: `HOST=0.0.0.0`
2. DB 테이블 반영 + 백엔드 재시작:
   ```powershell
   cd backend
   npx.cmd prisma migrate deploy
   cd ..
   npm.cmd run dev
   ```
3. Windows 방화벽 팝업 → 개인/공용 모두 허용.
4. PC Tailscale IP 확인: `tailscale ip -4` → 예 `100.64.0.5`
5. 폰 브라우저(Tailscale 켠 상태)에서 `http://100.64.0.5:3000/health` 열기 → JSON 나오면 OK.

### 9-1-3. 폰 준비

1. 설정 → 휴대전화 정보 → 소프트웨어 정보 → **빌드번호 7번 탭** → 개발자 모드 켜짐.
2. 설정 → 개발자 옵션 → **USB 디버깅** 켜기.
3. 폰 USB로 PC 연결 → 폰에 "USB 디버깅 허용?" → 허용 (항상 허용 체크).

### 9-1-4. 앱 빌드 + 설치

방법 A. USB로 바로 설치 (추천)
```powershell
cd frontend
npm.cmd install
npm.cmd run android:sync
npm.cmd run android:open
```
1. Android Studio 열림. 하단 Gradle 동기화 끝날 때까지 대기 (첫 회 수 분).
2. 상단 기기 목록에서 내 폰 선택 → ▶ Run.
3. 폰에 AURA 앱 설치되고 실행됨.

방법 B. APK 파일로 설치 (USB 연결 없이)
1. 위 명령까지 실행 → Android Studio: Build → Build App Bundle(s) / APK(s) → **Build APK(s)**.
2. 파일 위치: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
3. 카카오톡 나에게 보내기·구글 드라이브 등으로 폰에 옮김 → 폰에서 열기.
4. "출처를 알 수 없는 앱" 경고 → 설정 → 이 출처 허용 → 설치.
5. Play 프로텍트 경고 → "무시하고 설치".

### 9-1-5. 폰 앱 설정 (설정 마법사)

1. PC: AURA → 로비 → **📱 폰 감시** → 연결 QR 표시.
2. 폰: AURA 앱 첫 실행 시 설정 화면 자동으로 뜸. 순서대로 버튼만 누르면 됨.
   1. **PC 연결**: 📷 QR 스캔 → PC 화면 QR 찍기 (카메라 권한 허용). 삼성 카메라로 QR 찍고 링크 탭해도 됨.
   2. **사용 정보 접근**: 설정 열기 → AURA → 허용 → 뒤로.
      "제한된 설정" 팝업 시: 앱 정보 → 오른쪽 위 ⋮ → 제한된 설정 허용.
   3. **알림**: 허용.
   4. **배터리 제한 없음**: 팝업에서 허용. 안 뜨면 앱 정보 → 배터리 → 제한 없음.
   5. **감시 켜기**. 딴짓 앱은 유튜브·인스타·틱톡·넷플릭스 등 기본 선택됨. 완료 후 "딴짓 앱 편집"에서 변경.
3. 각 단계는 허용하고 돌아오면 자동으로 ✅.

### 9-1-6. 사용

- PC에서 공부 감시 시작 → 폰 감시 자동 활성 (30초 이내).
- 폰에서 딴짓 앱 열면 폰 알림 + PC 알림 창. 계속 쓰면 1분마다 다시 알림.
- "PC에서 공부 감시 켰을 때만" 체크 해제 → PC 세션 없이도 항상 감시.
- 끄기: 앱에서 감시 끄기, 또는 상단 알림의 "끄기".

### 9-1-7. 업데이트

`git` 으로 최신 받은 뒤:
```powershell
cd frontend
npm.cmd install
npm.cmd run android:sync
```
→ Android Studio ▶ Run (또는 APK 다시 빌드·설치). 기존 설정 유지됨.

### 9-1-8. 문제 해결

| 증상 | 해결 |
| --- | --- |
| 연결 실패 | PC·폰 Tailscale 켜짐 확인, `HOST=0.0.0.0`, 방화벽 허용, 주소에 `http://` 와 `:3000` 포함 |
| 감시 켜기 버튼 비활성 | 사용 정보 접근 권한 미허용 |
| 알림 안 옴 | 알림 권한, 방해 금지 모드, 앱 알림 설정의 "딴짓 경고" 채널 켜기 |
| 잠시 후 감시 꺼짐 | 배터리 최적화 제외. 샤오미·삼성은 자동 실행 허용도 필요 |
| PC 세션 대기에서 안 바뀜 | PC 공부 화면에서 감시 시작했는지, 백엔드 주소 맞는지 |
| Gradle 오류 | Android Studio → File → Sync Project with Gradle Files. 계속 실패 시 오류 로그 공유 |
| `cap` 명령 없음 | `frontend` 폴더에서 `npm.cmd install` 먼저 |

## 10. 테스트

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
