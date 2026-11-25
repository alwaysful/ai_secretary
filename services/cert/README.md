# 자격증 서비스

AURA 없이 단독 실행·배포하는 자격증 정보 서비스. NestJS + Prisma + PostgreSQL(자체 컨테이너, 포트 5433) + React 화면(`web/`).
AURA 비서는 이 서비스의 `/certs` API를 호출해 자기 자격증 탭에 씀 (선택).

- 공공데이터포털 API는 **배치로만** 호출 → DB 저장. 읽기 API는 DB만 조회.
  - 시험 일정: 하루 1번 / 새 자격증·공개문제·시험장소: 주 1번 / 취득자·합격률: 매시간 10종목씩(30일 주기) / 민간자격 등록정보: 30일
  - API별 하루 한도 800회, 같은 주소 12시간 캐시
- 사용자 자료(별표·고친 값·직접 추가·직접 일정)는 AURA가 보관. 이 서비스엔 없음.

## 실행

- Windows: `start-cert.bat` → Docker DB → 설치·마이그레이션·빌드 → 브라우저 http://127.0.0.1:3100 (화면 + API)
  - 이미 켜져 있으면 화면만 엶. 개발 모드(서버 자동 재시작): `start-cert.bat --dev`
- `npm run serve` (빌드 후 실행) / `npm run dev`
- 화면 개발: `cd web && npm run dev` (http://127.0.0.1:5174, /app → 3100)
- 단독 실행 때 별표·고친 값·직접 추가·직접 일정은 이 서비스 DB(`CertPref`·`CertCustom`·`CertUserExam`)에 저장
- 설정: `.env` (`.env.example` 참고). 키는 `QNET_API_KEY` 또는 화면에서 입력

## API

| 메서드 | 경로 | 내용 |
|---|---|---|
| GET | /certs/meta | 분야·종류·일정 묶음 이름 |
| POST | /certs/query | 목록 `{field, kind, q, ids}` |
| POST | /certs/calendar | 기간 회차 `{from, to, ...필터}` |
| GET | /certs/:id | 1개 |
| GET | /certs/:id/about | 설명·취득자·합격률·공개문제·민간 등록정보 |
| GET | /certs/places/branches, /certs/places?brch=01 | 시험장소 |
| GET | /certs/config, PUT /certs/config/key | 작업 상태·키 |
| POST | /certs/run | 지금 수집 `{jobs: [...]}` |
| POST | /certs/score | 유용도 참고값 |
| GET | /health | 상태 |
| * | /app/certs/... | 단독 화면용 (AURA 화면 API와 같은 모양, 사용자 값 포함) |

첫 실행 때 DB가 비어 있으면 옛 AURA DB(`../../backend/.env` DATABASE_URL 또는 `CERT_LEGACY_DATABASE_URL`)에서 자격증 자료를 가져옴.
