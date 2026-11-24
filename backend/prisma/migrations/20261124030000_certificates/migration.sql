-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "grade" TEXT,
    "org" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "series" TEXT,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertExam" (
    "id" UUID NOT NULL,
    "certId" TEXT,
    "series" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalKey" TEXT,
    "title" TEXT NOT NULL,
    "phase" TEXT,
    "regStart" TIMESTAMP(3),
    "regEnd" TIMESTAMP(3),
    "examStart" TIMESTAMP(3),
    "examEnd" TIMESTAMP(3),
    "resultAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "qnetKey" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Certificate_field_idx" ON "Certificate"("field");

-- CreateIndex
CREATE UNIQUE INDEX "CertExam_externalKey_key" ON "CertExam"("externalKey");

-- CreateIndex
CREATE INDEX "CertExam_certId_idx" ON "CertExam"("certId");

-- CreateIndex
CREATE INDEX "CertExam_series_idx" ON "CertExam"("series");

-- AddForeignKey
ALTER TABLE "CertExam" ADD CONSTRAINT "CertExam_certId_fkey" FOREIGN KEY ("certId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
