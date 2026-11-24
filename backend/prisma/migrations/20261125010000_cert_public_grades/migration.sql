-- 국가공인 등급·만료일
ALTER TABLE "Certificate" ADD COLUMN "publicGrades" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "publicUntil" TEXT;
