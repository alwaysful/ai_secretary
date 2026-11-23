-- AlterTable
ALTER TABLE "ScrapedPost" ADD COLUMN "eventStartsAt" TIMESTAMP(3),
ADD COLUMN "eventEndsAt" TIMESTAMP(3),
ADD COLUMN "summary" TEXT;

-- 위비티·링커리어: 이미 상세 확인한 글도 진행기간·요약 다시 채우기 (마감 안 지난 것만)
UPDATE "ScrapedPost" SET "detailAt" = NULL
WHERE "source" IN ('wevity', 'linkareer') AND ("deadline" IS NULL OR "deadline" >= CURRENT_TIMESTAMP);
