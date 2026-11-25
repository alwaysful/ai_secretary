-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "no" INTEGER,
    "name" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "grade" TEXT,
    "org" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "series" TEXT,
    "prep" TEXT,
    "fee" TEXT,
    "validity" TEXT,
    "jmCd" TEXT,
    "publicGrades" TEXT,
    "publicUntil" TEXT,
    "statsYears" JSONB,
    "statsTotal" INTEGER,
    "statsAt" TIMESTAMP(3),
    "statsError" TEXT,
    "passYears" JSONB,
    "detail" JSONB,
    "discoveredAt" TIMESTAMP(3),
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
    "source" TEXT NOT NULL DEFAULT 'qnet',
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

    CONSTRAINT "CertConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertJob" (
    "name" TEXT NOT NULL,
    "lastAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertJob_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "CertApiUsage" (
    "api" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "month" TEXT NOT NULL,
    "monthCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertApiUsage_pkey" PRIMARY KEY ("api")
);

-- CreateTable
CREATE TABLE "CertApiCache" (
    "key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertApiCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CertQuestion" (
    "id" TEXT NOT NULL,
    "jmCd" TEXT NOT NULL,
    "jmNm" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "date" TEXT,

    CONSTRAINT "CertQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertPlace" (
    "id" SERIAL NOT NULL,
    "brchCd" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tel" TEXT NOT NULL,
    "guide" TEXT NOT NULL,

    CONSTRAINT "CertPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertRegistry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normName" TEXT NOT NULL,
    "regDate" TEXT,
    "status" TEXT NOT NULL,
    "ministry" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT NOT NULL,
    "grades" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CertRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_no_key" ON "Certificate"("no");

-- CreateIndex
CREATE INDEX "Certificate_field_idx" ON "Certificate"("field");

-- CreateIndex
CREATE INDEX "Certificate_kind_idx" ON "Certificate"("kind");

-- CreateIndex
CREATE INDEX "Certificate_jmCd_idx" ON "Certificate"("jmCd");

-- CreateIndex
CREATE UNIQUE INDEX "CertExam_externalKey_key" ON "CertExam"("externalKey");

-- CreateIndex
CREATE INDEX "CertExam_certId_idx" ON "CertExam"("certId");

-- CreateIndex
CREATE INDEX "CertExam_series_idx" ON "CertExam"("series");

-- CreateIndex
CREATE INDEX "CertApiCache_at_idx" ON "CertApiCache"("at");

-- CreateIndex
CREATE INDEX "CertQuestion_jmCd_idx" ON "CertQuestion"("jmCd");

-- CreateIndex
CREATE INDEX "CertPlace_brchCd_idx" ON "CertPlace"("brchCd");

-- CreateIndex
CREATE INDEX "CertRegistry_normName_idx" ON "CertRegistry"("normName");

-- AddForeignKey
ALTER TABLE "CertExam" ADD CONSTRAINT "CertExam_certId_fkey" FOREIGN KEY ("certId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

