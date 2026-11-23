ALTER TABLE "AppSettings" ADD COLUMN "chatSource" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "AppSettings" ADD COLUMN "chatProvider" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "chatApiModel" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "ocrSource" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "AppSettings" ADD COLUMN "ocrProvider" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "ocrApiModel" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "sttSource" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "AppSettings" ADD COLUMN "sttProvider" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "sttApiModel" TEXT;

CREATE TABLE "ApiKey" (
    "provider" TEXT NOT NULL,
    "cipher" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("provider")
);
