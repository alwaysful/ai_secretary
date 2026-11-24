-- 자격증 취득자 통계 (Q-net 종목별)
ALTER TABLE "Certificate" ADD COLUMN "jmCd" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "statsYears" JSONB;
ALTER TABLE "Certificate" ADD COLUMN "statsTotal" INTEGER;
ALTER TABLE "Certificate" ADD COLUMN "statsAt" TIMESTAMP(3);
