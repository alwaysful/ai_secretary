-- CreateTable
CREATE TABLE "StudySession" (
    "id" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "focusSec" INTEGER NOT NULL DEFAULT 0,
    "pomodoros" INTEGER NOT NULL DEFAULT 0,
    "posture" INTEGER NOT NULL DEFAULT 0,
    "phone" INTEGER NOT NULL DEFAULT 0,
    "slack" INTEGER NOT NULL DEFAULT 0,
    "sleep" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudySession_startedAt_idx" ON "StudySession"("startedAt");
