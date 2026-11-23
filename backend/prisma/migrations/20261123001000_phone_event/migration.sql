-- CreateTable
CREATE TABLE "PhoneEvent" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "package" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "PhoneEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneEvent_at_idx" ON "PhoneEvent"("at");
