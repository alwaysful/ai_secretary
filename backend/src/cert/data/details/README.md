# 자격증 설명 데이터

「설명」 버튼 내용. 이 폴더 JSON 이 원본. 서버 시작 때 DB 로 복사.

## 파일
- `종류/분야.json` (예: `국가기술/전기·전자.json`). 나누는 기준은 정리용일 뿐, 하위 폴더 아무 `.json` 다 읽음.
- 한 파일 = `{ "자격증 id": 항목, ... }`. id 는 자격증 목록(catalog)의 id.
- 같은 id 가 두 파일에 있으면 오류.

## 항목 형식
1. **양식(tpl)** — 공통 문구는 `src/cert/details-templates.ts` 가 채움. 값만 적음.
   - `"기술사"`: `what`, `subjects`, `use`, `study`
   - `"기사"`: `what`, `subjects`, `practical`, `rate`, `use`, `study` + 선택 `books`(배열), `orgName`·`orgUrl`(Q-net 아닌 시행처)
   ```json
   "q-기계기술사": { "tpl": "기술사", "what": "...", "subjects": "...", "use": "...", "study": "..." }
   ```
2. **직접 작성** — 배열 그대로.
   ```json
   "it-ipe": [
     { "label": "무엇", "text": "..." },
     { "label": "준비 도서", "text": "...", "items": ["책1", "책2"] },
     { "label": "링크", "text": "...", "links": [{ "label": "Q-net", "url": "https://www.q-net.or.kr" }] }
   ]
   ```
   label 권장 순서: 무엇, 시행, 응시자격, 필기, 실기, 합격 기준, 합격률, 쓰임, 준비 도서, 공부법, 링크.

같은 모양 항목이 많으면 `details-templates.ts` 에 양식 추가 (required/optional/build).

## 검사
```
cd backend
npm run check:details            # 형식·중복·모르는 id 검사
npm run check:details -- --missing   # 설명 없는 자격증 목록
```
오류 난 항목은 서버가 건너뛰고 경고만 찍음.
