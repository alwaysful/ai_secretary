# AURA 자격증 서비스

AURA 비서와 따로 배포하는 자격증 정보 서비스. NestJS + Prisma + PostgreSQL(자체 컨테이너, 포트 5433).

- 공공데이터포털 API는 **배치로만** 호출 → DB 저장. 읽기 API는 DB만 조회.
  - 시험 일정: 하루 1번 / 새 자격증·공개문제·시험장소: 주 1번 / 취득자·합격률: 매시간 10종목씩(30일 주기) / 민간자격 등록정보: 30일
  - API별 하루 한도 800회, 같은 주소 12시간 캐시
- 사용자 자료(별표·고친 값·직접 추가·직접 일정)는 AURA가 보관. 이 서비스엔 없음.

## 실행

- Windows: `start-cert.bat` (Docker DB → 설치·마이그레이션 → http://127.0.0.1:3100)
- `npm run dev` / 운영: `npm run serve` (빌드 후 실행)
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

첫 실행 때 DB가 비어 있으면 옛 AURA DB(`../../backend/.env` DATABASE_URL 또는 `CERT_LEGACY_DATABASE_URL`)에서 자격증 자료를 가져옴.
