-- AlterTable
ALTER TABLE "ScrapedPost" ADD COLUMN "startsAt" TIMESTAMP(3),
ADD COLUMN "detailAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ScrapedPost_deadline_idx" ON "ScrapedPost"("deadline");

-- 기존 설치: '공모전' 카테고리에 콘테스트코리아 추가 (1회)
INSERT INTO "NewsSite" ("id", "name", "url", "parser", "categoryId", "position", "updatedAt")
SELECT 'contestkorea', '콘테스트코리아', 'https://www.contestkorea.com/sub/list.php?int_gbn=1', 'contestkorea', c."id",
       COALESCE((SELECT MAX("position") + 1 FROM "NewsSite"), 0), CURRENT_TIMESTAMP
FROM "NewsCategory" c
WHERE c."name" = '공모전' AND NOT EXISTS (SELECT 1 FROM "NewsSite" WHERE "id" = 'contestkorea')
ORDER BY c."position"
LIMIT 1;
