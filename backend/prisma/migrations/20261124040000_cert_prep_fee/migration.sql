-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN "fee" TEXT,
ADD COLUMN "prep" TEXT,
ADD COLUMN "userFee" TEXT,
ADD COLUMN "userPrep" TEXT;

ALTER TABLE "Certificate" ADD COLUMN "discoveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CertConfig" ADD COLUMN "lastCatalogAt" TIMESTAMP(3),
ADD COLUMN "lastCatalogNew" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastCatalogError" TEXT;
