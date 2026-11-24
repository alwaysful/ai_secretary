-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "companionAffinity" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "companionLastAt" TIMESTAMP(3);
