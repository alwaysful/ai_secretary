-- 자격증 기능 분리: 자격증 정보는 자격증 서비스(services/cert, DB aura_cert)로.
-- AURA엔 사용자 값만. 옛 표(Certificate, CertExam, CertConfig, CertApiCache)는 자격증 서비스가 첫 실행 때 가져가도록 남겨 둠 (나중에 삭제).

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

CREATE INDEX "CertUserExam_certId_idx" ON "CertUserExam"("certId");

-- 옛 자료 옮기기
INSERT INTO "CertPref" ("certId", "starred", "userPrep", "userFee", "userValidity", "userScore", "updatedAt")
SELECT "id", "starred", "userPrep", "userFee", "userValidity", "userScore", CURRENT_TIMESTAMP
FROM "Certificate"
WHERE "starred" OR "custom" OR "userPrep" IS NOT NULL OR "userFee" IS NOT NULL OR "userValidity" IS NOT NULL OR "userScore" IS NOT NULL;

INSERT INTO "CertCustom" ("id", "no", "name", "field", "kind", "grade", "org", "url", "summary", "position", "createdAt")
SELECT "id", "no", "name", "field", "kind", "grade", "org", "url", "summary", "position", "createdAt"
FROM "Certificate" WHERE "custom";

INSERT INTO "CertUserExam" ("id", "certId", "title", "phase", "regStart", "regEnd", "examStart", "examEnd", "resultAt", "note", "createdAt")
SELECT "id", "certId", "title", "phase", "regStart", "regEnd", "examStart", "examEnd", "resultAt", "note", "createdAt"
FROM "CertExam" WHERE "source" = 'manual' AND "certId" IS NOT NULL;
