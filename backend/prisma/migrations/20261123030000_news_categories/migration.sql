-- DropTable
DROP TABLE IF EXISTS "ScrapeSourceState";

-- CreateTable
CREATE TABLE "NewsCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsSite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "parser" TEXT NOT NULL DEFAULT 'auto',
    "itemSelector" TEXT,
    "categoryId" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastNew" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsSite_categoryId_position_idx" ON "NewsSite"("categoryId", "position");

-- AddForeignKey
ALTER TABLE "NewsSite" ADD CONSTRAINT "NewsSite_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NewsCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
