-- 자격증 번호(종류별 대역) + 상세 설명 Json
ALTER TABLE "Certificate" ADD COLUMN "no" INTEGER;
ALTER TABLE "Certificate" ADD COLUMN "detail" JSONB;
CREATE UNIQUE INDEX "Certificate_no_key" ON "Certificate"("no");
CREATE INDEX "Certificate_kind_idx" ON "Certificate"("kind");

-- 종류 이름 정리: 민간 → 등록민간, 어학 → 국제·어학 (해외 기관 자격은 시작 때 코드가 국제·어학으로 옮김)
UPDATE "Certificate" SET "kind" = '등록민간' WHERE "kind" = '민간';
UPDATE "Certificate" SET "kind" = '국제·어학' WHERE "kind" = '어학';
