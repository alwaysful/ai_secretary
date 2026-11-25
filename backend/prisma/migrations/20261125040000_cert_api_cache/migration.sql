-- CreateTable
CREATE TABLE "CertApiCache" (
    "key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertApiCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "CertApiCache_at_idx" ON "CertApiCache"("at");
