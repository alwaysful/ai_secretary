-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "companionVoice" JSONB,
ADD COLUMN "companionPresets" JSONB,
ADD COLUMN "companionModel" TEXT,
ADD COLUMN "budgetUsd" DOUBLE PRECISION,
ADD COLUMN "budgetWarnPct" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN "budgetBlock" BOOLEAN NOT NULL DEFAULT false;
