-- CreateTable
CREATE TABLE "ScrapedPost" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT,
    "author" TEXT,
    "postedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeSourceState" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastNew" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeSourceState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapedPost_source_externalId_key" ON "ScrapedPost"("source", "externalId");

-- CreateIndex
CREATE INDEX "ScrapedPost_source_createdAt_idx" ON "ScrapedPost"("source", "createdAt");

-- CreateIndex
CREATE INDEX "ScrapedPost_seenAt_idx" ON "ScrapedPost"("seenAt");
