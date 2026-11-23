CREATE TABLE "ApiUsage" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "audioSec" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiUsage_at_idx" ON "ApiUsage"("at");

CREATE TABLE "ApiPrice" (
    "model" TEXT NOT NULL,
    "input" DOUBLE PRECISION NOT NULL,
    "output" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiPrice_pkey" PRIMARY KEY ("model")
);
