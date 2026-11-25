# AURA 810 (ai_secretary)

내 PC에서 돌아가는 개인 AI 비서. 대화·메일·일정·기억은 로컬 DB에만 저장.

- 백엔드: NestJS + Prisma + PostgreSQL (TypeScript)
- 프론트: React + Vite (TypeScript), Android 앱은 Capacitor
- AI: Ollama 로컬 모델 기본. 선택적으로 Gemini·Anthropic·OpenAI API
- Python: PC 조작·STT 보조 프로세스 (pyautogui, faster-whisper는 Python 전용 라이브러리라 사용)

## 기능

| 기능 | 내용 |
|---|---|
| 💬 AI 채팅 | 스트리밍, 마크다운·코드 표시, 복사, 재생성, 마지막 메시지 편집, 대화 검색. 메일·일정·공지를 읽어서 답함. `PC: 할 일` 로 PC 조작 |
| ✉️ 메일 | Outlook 받은편지함 읽기 전용 |
| 📅 일정 | Outlook 캘린더 조회. 채팅으로 생성·수정 → 확인 버튼 눌러야 반영 |
| ☀️ 아침 브리핑 | 오늘 일정 + 안 읽은 메일 요약 |
| 📰 새 소식 | 학사공지·공모전 스크래핑. #분야 태그, ☰ 목록 / 📅 달력 보기, 구글 캘린더 추가 버튼, 새 글 알림 |
| 📚 공부 집중 | 웹캠(자세·졸음·폰)·화면(딴짓) 감시. 🤖로봇/🧑인간 말투, 🍅 뽀모도로 |
| 📱 폰 감시 | Android 앱. 딴짓 앱 열면 알림 (UsageStats). QR 연결 + 설정 마법사 |
| 🖱️ PC 조작 | AI가 화면 보고 마우스·키보드 조작 (PC만). 시작 전 확인 |
| 🛠️ 도구 | STT(음성→글자), OCR(이미지→글자), 내 사이트 목록 |
| 📇 단어장 | 단어장 JSON 업로드 → Anki식 간격 반복 복습·회독·4지선다 퀴즈·진도 통계. 양식·예시는 앱 안 「📄 단어장 파일 양식」 |
| 📊 통계 | 공부 시간·위반, 채팅 사용량, 공지 수, API 사용량·예상 비용 |
| 🎓 자격증 | 별도 앱 [alwaysful/cert-search](https://github.com/alwaysful/cert-search) (자체 DB·화면·`start-cert.bat`). AURA는 `CERT_API_URL`(기본 http://127.0.0.1:3100)로 호출, 별표·직접 수정값만 AURA DB. `ai_secretary` 옆 폴더 `cert-search` 에 받아 두면 start-aura.bat 가 같이 켬 |
| 🧠 기억 | 취향·사실·프로젝트 저장 → 모든 대화에 반영 |
| ⚙️ 설정 | 권한(화면 읽기·PC 조작·마이크·웹캠), 기능별 모델(로컬 / Gemini·Anthropic·OpenAI API), API 키, 시스템 프롬프트 |
| ⬇️ 모델 받기 | 🦙 Ollama · 🤗 Hugging Face · 🎙 Whisper · 🧩 다른 로컬 앱. 크기·RAM 비교 후 다운로드 |
| 🏠 로비 | 일정·메일·새 소식 위젯, 🌐 웹사이트 바로가기, 기능 카드, 🚀 시작 가이드, ℹ️ 정보(기능 설명, 📄 PDF로 저장), ⏻ 서버 끄기 |
| 기타 | 첫 접속 소개 페이지(`#landing`), 다크 모드, 단축키(`?`), 모바일 화면 |

## 1. 준비물

| 항목 | 필수 | 버전 | 확인 |
|---|---|---|---|
| Git | 필수 | 최신 | `git --version` |
| Node.js | 필수 | 20 이상 (Android 빌드는 22 이상) | `node -v` |
| Docker Desktop | 필수 | 최신, 실행 상태 | `docker --version` |
| Ollama | 필수 (API만 쓰면 생략 가능) | 최신 | `ollama --version` |
| Python | 선택: PC 조작·STT | 3.10 이상, 설치 시 "Add to PATH" 체크 | `python --version` |

- RAM 16GB 권장. 디스크 여유 약 10GB (모델 크기에 따라 증가).
- Windows PowerShell은 `npm` 대신 `npm.cmd`, `npx` 대신 `npx.cmd`.

## 2. 처음 설치

```powershell
git clone https://github.com/alwaysful/ai_secretary.git
cd ai_secretary
copy backend\.env.example backend\.env     # macOS/Linux: cp backend/.env.example backend/.env
npm.cmd run install:all                      # 루트·backend·frontend 패키지
```

Python 기능(선택):
```powershell
python -m pip install -r pc-agent\requirements.txt       # PC 조작
python -m pip install -r pc-agent\requirements-stt.txt   # 도구 탭 STT (Whisper)
```

- `.env` 기본값 그대로 사용 가능.
- DB 테이블은 실행 때 자동 생성 (`npm run dev`가 `prisma migrate deploy` 실행).
- `start-aura.bat`는 위 패키지·Python 라이브러리 설치도 자동 시도.

## 3. 모델

앱에서 받기: 로비 → **⬇️ 모델 받기** → 원하는 모델 다운로드 → **⚙️ 설정**에서 선택.

| 용도 | 추천 | 비고 |
|---|---|---|
| 채팅·브리핑 (필수) | `qwen3:4b` | 약 2.5GB. 터미널: `ollama pull qwen3:4b` |
| 공부 화면 딴짓 분석 | `gemma4:12b` | `.env` `STUDY_VISION_MODEL` |
| PC 조작·OCR | `qwen2.5vl:7b` | `.env` `PC_VISION_MODEL`, `OCR_VISION_MODEL` (비우면 서로 대체) |
| STT | Whisper `small` | 첫 사용 때 자동 다운로드. `.env` `STT_MODEL` |
| 공부 자세·졸음·폰 | MediaPipe 3종 | `npm.cmd run models` → `frontend/public/models/` |

- Ollama 모델은 Ollama가 자동 저장 (`%USERPROFILE%\.ollama\models`). 폴더에 직접 넣지 말 것.
- PC가 느리면 API 사용: ⚙️ 설정 → 🔑 API 키 입력 → 기능(채팅·OCR·STT)별로 API 선택. 키는 PC에 암호화 저장. 비용은 📊 통계에서 확인.

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

## 4-1. 처음 켰을 때

1. 소개 페이지 → Get Started → **🚀 시작 가이드** 자동 표시. 설치 상태(서버·모델·권한·Outlook·Python)를 자동 확인하며 순서대로 안내. 단계 오른쪽 「▶」 버튼: DB 시작·Ollama 켜기·모델 다운로드·기본 권한·Outlook 로그인·pip 설치·감지 모델 받기를 자동 실행 (PC에서만). 다시 열기: 로비 「🚀 시작 가이드」.
2. ⚙️ 설정 → 권한: 쓸 기능만 켜기 (화면 읽기·PC 조작·마이크·웹캠).
3. ⚙️ 설정 → 모델: 채팅 모델 선택 (또는 API 키 입력 후 API 선택).
4. ✉️ 메일 → Outlook 연결 (6번 설정 필요).
5. 기능 설명은 로비 **ℹ️ 정보** (Alt+9). 📄 PDF로 저장 → 인쇄 창 대상 "PDF로 저장".

## 4-2. PC 조작 (선택)

1. Python + `pc-agent\requirements.txt` 설치 (2번).
2. 비전 모델: `qwen2.5vl:7b` 받기 → `backend/.env`에 `PC_VISION_MODEL=qwen2.5vl:7b`.
3. ⚙️ 설정 → 권한: 화면 읽기 + PC 조작 켜기.
4. 로비 → 🖱️ PC 조작 → 할 일 입력 → 확인 → 시작. 채팅에서 `PC: 할 일` 도 가능.

- 중지: Esc, Ctrl+Alt+X, 마우스를 화면 모서리로, 화면 위 ■ 정지 버튼.
- 주 모니터만. 관리자 권한 창은 조작 불가. 최대 단계 `PC_MAX_STEPS` (기본 25).

## 4-3. 새 소식 (공지·공모전)

- 1시간마다 자동 확인 (`SCRAPE_INTERVAL_MIN`, 0이면 끔).
- ⚙ 관리에서 사이트 추가: 게시판 주소만 넣으면 형식 자동 감지.

## 5. 업데이트 (PC)

```powershell
cd ai_secretary
git pull                          # .env·모델·DB는 유지
npm.cmd run install:all
```
- DB 변경은 다음 실행 때 자동 적용.
- 업데이트 후 Python 기능 오류 시 2번 pip 명령 다시 실행.

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
| 공부 카메라 분석 안 됨 | `frontend/public/models/`에 모델 3개 확인 (`npm.cmd run models`), 설정 웹캠 권한 |
| `table ... does not exist` | `npm.cmd run dev`로 실행 (마이그레이션 자동). 또는 `npm.cmd run migrate` |
| PC 조작·STT 시작 안 됨 | `python --version`, 2번 pip 설치, 설정 권한(PC 조작·마이크) 확인. Python 경로는 `.env` `PC_PYTHON` |
| API 401·403 | 설정의 API 키 확인 |
| 새 소식 비어 있음 | 새로고침 버튼. 사이트 구조 변경 시 ⚙ 관리 → 미리보기로 확인 |

## 주의

- API 인증 없음. 기본 `HOST=127.0.0.1`. 폰 연동 시에만 `0.0.0.0` + Tailscale 사용. 공유기 포트 개방 금지.
- `.env`, 모델 파일, DB 파일 커밋 금지.
- 일정 변경·PC 조작은 사용자 확인 후에만 실행. 권한은 설정에서 언제든 끄기.
- API 선택 시 해당 기능의 입력은 그 공급자 서버로 전송됨. 로컬만 쓰려면 모두 "로컬".

## 구조

```
backend/    NestJS API (대화, 메일, 일정, 브리핑, 기억, 설정, 공부, 폰, 스크래핑, PC 조작, 도구, 통계, 모델 허브, 단어장)
frontend/   React 웹 + Android(Capacitor) 앱
pc-agent/   Python: PC 조작(pyautogui), STT(faster-whisper)
scripts/    dev 실행 래퍼, MediaPipe 모델 다운로드
```

- 백엔드 API 상세: `backend/README.md`
