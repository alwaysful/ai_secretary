-- CreateTable
CREATE TABLE "CertPref" (
    "certId" TEXT NOT NULL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "userPrep" TEXT,
    "userFee" TEXT,
    "userValidity" TEXT,
    "userScore" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertPref_pkey" PRIMARY KEY ("certId")
);

-- CreateTable
CREATE TABLE "CertCustom" (
    "id" TEXT NOT NULL,
    "no" INTEGER,
    "name" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "grade" TEXT,
    "org" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertCustom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertUserExam" (
    "id" UUID NOT NULL,
    "certId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phase" TEXT,
    "regStart" TIMESTAMP(3),
    "regEnd" TIMESTAMP(3),
    "examStart" TIMESTAMP(3),
    "examEnd" TIMESTAMP(3),
    "resultAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertUserExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertUserExam_certId_idx" ON "CertUserExam"("certId");

