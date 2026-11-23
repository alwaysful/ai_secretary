# AURA 810 (ai_secretary)

내 PC에서 돌아가는 개인 AI 비서. 대화·메일·일정·기억은 로컬 DB에만 저장.

- 백엔드: NestJS + Prisma + PostgreSQL (TypeScript)
- 프론트: React + Vite (TypeScript), Android 앱은 Capacitor
- AI: Ollama 로컬 모델. 공부 감시 영상 분석은 브라우저 MediaPipe

## 기능

| 기능 | 내용 |
|---|---|
| 💬 AI 채팅 | 스트리밍 응답, 마크다운·코드 표시, 복사, 재생성, 마지막 메시지 편집, 대화 검색 |
| ✉️ 메일 | Outlook 받은편지함 읽기 전용. 채팅에서 "안 읽은 메일 요약" 가능 |
| 📅 일정 | Outlook 캘린더 조회. 채팅으로 일정 생성·수정 → 사용자가 확인해야 실제 반영 |
| ☀️ 아침 브리핑 | 오늘 일정 + 안 읽은 메일 요약 |
| 🧠 기억 | 취향·사실·프로젝트 저장 → 모든 대화에 자동 반영 |
| ⚙️ 설정 | 모델 선택, 시스템 프롬프트 수정 |
| 📚 공부 집중 | 웹캠(자세·졸음·폰), 화면(딴짓) 감시. 🤖로봇/🧑인간 말투 토글, 🍅 뽀모도로, 일별·주별 통계 |
| 📱 폰 감시 | Android 앱. 딴짓 앱 열면 알림 (UsageStats). QR 연결 + 설정 마법사 |
| 🏠 로비 | 오늘 일정·안 읽은 메일 위젯, 바로가기, ℹ️ 정보(기능 설명) |
| 기타 | 다크 모드, 단축키(`?`), 모바일 화면 |

## 1. 준비물

| 항목 | 버전 | 확인 |
|---|---|---|
| Git | 최신 | `git --version` |
| Node.js | 20 이상 (Android 빌드는 22 이상) | `node -v` |
| Docker Desktop | 최신, 실행 상태 | `docker --version` |
| Ollama | 최신, 실행 상태 | `ollama --version` |

- RAM 16GB 권장. 디스크 여유 약 10GB.
- Windows PowerShell은 `npm` 대신 `npm.cmd`, `npx` 대신 `npx.cmd`.

## 2. 설치

```powershell
git clone https://github.com/alwaysful/ai_secretary.git
cd ai_secretary
copy backend\.env.example backend\.env     # macOS/Linux: cp backend/.env.example backend/.env
npm.cmd run install:all                      # 루트·backend·frontend 패키지
npm.cmd run db:up                            # PostgreSQL (Docker)
npm.cmd run migrate                          # DB 테이블 생성
```

- `.env` 기본값 그대로 사용 가능.
- `migrate` 실패 시 DB 기동 10초 대기 후 재시도.

## 3. 모델 받기

| 용도 | 모델 | 받는 법 | 크기 |
|---|---|---|---|
| 채팅·브리핑 (필수) | `qwen3:4b` | `ollama pull qwen3:4b` | 약 2.5GB |
| 공부 집중: 화면 딴짓 분석 | `gemma4:12b` | `ollama pull gemma4:12b` | 수 GB |
| 공부 집중: 자세·졸음·폰 | MediaPipe 3종 | `npm.cmd run models` | 약 17MB |

- Ollama 모델은 Ollama가 자동 저장 (`%USERPROFILE%\.ollama\models`). 폴더에 직접 넣지 말 것.
- 채팅 모델은 앱 「설정」에서 설치된 모델 중 선택. 화면 분석 모델은 `backend/.env`의 `STUDY_VISION_MODEL` (이미지 입력 모델만).
- MediaPipe 모델은 `frontend/public/models/`에 저장됨. git 제외 대상.

## 4. 실행

방법 A. 더블클릭: 루트의 `start-aura.bat`
- Docker·DB·Ollama 자동 시작 → 브라우저 자동 열림.

방법 B. 터미널 (루트에서):
```powershell
npm.cmd start        # DB 시작 + 백엔드 + 프론트
```

- 화면: http://127.0.0.1:5173
- API: http://127.0.0.1:3000 (`/health`에서 `"status":"ok"` 확인)
- 첫 응답은 모델 적재로 수십 초 걸릴 수 있음.

## 5. 업데이트 (PC)

```powershell
cd ai_secretary
git fetch origin
git reset --hard origin/main      # 로컬 수정 사항 삭제됨. .env·모델·DB는 유지
npm.cmd run install:all
npm.cmd run migrate
```

## 6. Outlook 연동 (선택, 메일·일정)

메일은 읽기 전용. 일정은 조회 + 채팅에서 확인 후 생성·수정.

1. Entra ID(Azure)에서 앱 등록.
   - 플랫폼: 모바일 및 데스크톱
   - 공개 클라이언트 흐름 허용: 예
   - 위임 권한: `User.Read`, `Mail.Read`, `Calendars.ReadWrite`
2. 암호화 키 생성:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. `backend/.env`에 입력 후 서버 재시작:
   ```
   MS_CLIENT_ID=<앱 클라이언트 ID>
   TOKEN_ENC_KEY=<위 64자리 키>
   ```
4. 앱 「메일」 화면에서 연결 → 표시된 주소 접속 → 코드 입력.
5. 권한 범위가 바뀐 버전으로 업데이트했다면 연결 해제 후 다시 로그인.

- `TOKEN_ENC_KEY` 분실·변경 시 재로그인 필요.
- 메일 본문은 DB에 저장 안 함.

## 7. Android 앱 + 폰 감시 (선택)

PC 공부 감시 중 폰에서 딴짓 앱(유튜브·인스타 등)을 열면 폰 알림 + 공부 통계에 기록.
화면 캡처 없이 UsageStats(지금 켜진 앱 이름)만 사용. Android 전용.

### 7-1. 준비물 (PC)

| 항목 | 설치 |
| --- | --- |
| Node 22 이상 | `node -v` 확인. 낮으면 [nodejs.org](https://nodejs.org) LTS 설치 |
| Android Studio | [developer.android.com/studio](https://developer.android.com/studio) 설치. 첫 실행 시 Standard 설치 → SDK 자동 설치 |
| Tailscale | PC·폰 둘 다 [tailscale.com](https://tailscale.com/download) 설치, 같은 계정 로그인 |

Android Studio 첫 실행 후: More Actions → SDK Manager → Android SDK Platform 36 체크 확인.

### 7-2. 백엔드 외부 접속 허용 (PC)

1. `backend/.env` 수정: `HOST=0.0.0.0`
2. DB 테이블 반영 + 백엔드 재시작:
   ```powershell
   npm.cmd run migrate
   npm.cmd start
   ```
3. Windows 방화벽 팝업 → 개인/공용 모두 허용.
4. PC Tailscale IP 확인: `tailscale ip -4` → 예 `100.64.0.5`
5. 폰 브라우저(Tailscale 켠 상태)에서 `http://100.64.0.5:3000/health` 열기 → JSON 나오면 OK.

### 7-3. 폰 준비

1. 설정 → 휴대전화 정보 → 소프트웨어 정보 → **빌드번호 7번 탭** → 개발자 모드 켜짐.
2. 설정 → 개발자 옵션 → **USB 디버깅** 켜기.
3. 폰 USB로 PC 연결 → 폰에 "USB 디버깅 허용?" → 허용 (항상 허용 체크).

### 7-4. 앱 빌드 + 설치

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

### 7-5. 폰 앱 설정 (설정 마법사)

1. PC: AURA → 로비 → **📱 폰 감시** → 연결 QR 표시.
2. 폰: AURA 앱 첫 실행 시 설정 화면 자동으로 뜸. 순서대로 버튼만 누르면 됨.
   1. **PC 연결**: 📷 QR 스캔 → PC 화면 QR 찍기 (카메라 권한 허용). 삼성 카메라로 QR 찍고 링크 탭해도 됨.
   2. **사용 정보 접근**: 설정 열기 → AURA → 허용 → 뒤로.
      "제한된 설정" 팝업 시: 앱 정보 → 오른쪽 위 ⋮ → 제한된 설정 허용.
   3. **알림**: 허용.
   4. **배터리 제한 없음**: 팝업에서 허용. 안 뜨면 앱 정보 → 배터리 → 제한 없음.
   5. **감시 켜기**. 딴짓 앱은 유튜브·인스타·틱톡·넷플릭스 등 기본 선택됨. 완료 후 "딴짓 앱 편집"에서 변경.
3. 각 단계는 허용하고 돌아오면 자동으로 ✅.

### 7-6. 사용

- PC에서 공부 감시 시작 → 폰 감시 자동 활성 (30초 이내).
- 폰에서 딴짓 앱 열면 폰 알림 + PC 알림 창. 계속 쓰면 1분마다 다시 알림.
- "PC에서 공부 감시 켰을 때만" 체크 해제 → PC 세션 없이도 항상 감시.
- 끄기: 앱에서 감시 끄기, 또는 상단 알림의 "끄기".

### 7-7. 업데이트

5번(업데이트) 후:
```powershell
cd frontend
npm.cmd install
npm.cmd run android:sync
```
→ Android Studio ▶ Run (또는 APK 다시 빌드·설치). 기존 설정 유지됨.

### 7-8. 문제 해결

| 증상 | 해결 |
| --- | --- |
| 연결 실패 | PC·폰 Tailscale 켜짐 확인, `HOST=0.0.0.0`, 방화벽 허용, 주소에 `http://` 와 `:3000` 포함 |
| 감시 켜기 버튼 비활성 | 사용 정보 접근 권한 미허용 |
| 알림 안 옴 | 알림 권한, 방해 금지 모드, 앱 알림 설정의 "딴짓 경고" 채널 켜기 |
| 잠시 후 감시 꺼짐 | 배터리 최적화 제외. 샤오미·삼성은 자동 실행 허용도 필요 |
| PC 세션 대기에서 안 바뀜 | PC 공부 화면에서 감시 시작했는지, 백엔드 주소 맞는지 |
| Gradle 오류 | Android Studio → File → Sync Project with Gradle Files. 계속 실패 시 오류 로그 공유 |
| `cap` 명령 없음 | `frontend` 폴더에서 `npm.cmd install` 먼저 |

## 8. 테스트

```powershell
npm.cmd test
```

DB, Ollama 없이 실행됨.

## 9. 문제 해결

| 증상 | 해결 |
|---|---|
| `npm.ps1 ... 스크립트를 실행할 수 없으므로` | `npm.cmd` 사용 |
| `/health`에서 `db: "down"` | `npm.cmd run db:up`. Docker Desktop 실행 확인 |
| 대화 시 503 | Ollama 미실행. 앱 실행 또는 `ollama serve` |
| 대화 시 `model not pulled` | `ollama pull qwen3:4b` 또는 설정에서 설치된 모델 선택 |
| 대화 시 504 | 모델 느림. `.env`의 `MODEL_TIMEOUT_MS` 증가 |
| `Invalid environment: ...` | `.env` 값 오류. 메시지의 변수명 확인 |
| 포트 3000 사용 중 | `.env`의 `PORT` 변경 |
| 메일·일정 `NOT_CONNECTED` | 6번 로그인 재수행 |
| 일정 생성 실패 (권한) | `Calendars.ReadWrite` 추가 후 재로그인 |
| 공부 화면 분석 503 | `ollama pull gemma4:12b` 또는 `STUDY_VISION_MODEL` 확인 |
| 공부 카메라 분석 안 됨 | `frontend/public/models/`에 모델 3개 확인 (`npm.cmd run models`) |

## 주의

- API 인증 없음. 기본 `HOST=127.0.0.1`. 폰 연동 시에만 `0.0.0.0` + Tailscale 사용. 공유기 포트 개방 금지.
- `.env`, 모델 파일, DB 파일 커밋 금지.
- AI는 쓰기 작업을 직접 실행 못 함. 일정 변경은 사용자 확인 버튼으로만 반영.

## 구조

```
backend/    NestJS API (대화, 메일, 일정, 브리핑, 기억, 설정, 공부, 폰)
frontend/   React 웹 + Android(Capacitor) 앱
scripts/    MediaPipe 모델 다운로드
```

- 백엔드 API 상세: `backend/README.md`
