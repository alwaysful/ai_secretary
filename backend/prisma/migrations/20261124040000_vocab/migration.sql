-- CreateTable
CREATE TABLE "VocabDeck" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "newPerDay" INTEGER NOT NULL DEFAULT 20,
    "reviewPerDay" INTEGER NOT NULL DEFAULT 200,
    "direction" TEXT NOT NULL DEFAULT 'front',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabCard" (
    "id" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "reading" TEXT,
    "example" TEXT,
    "exampleMeaning" TEXT,
    "note" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "state" TEXT NOT NULL DEFAULT 'new',
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "step" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3),
    "lastAt" TIMESTAMP(3),
    "roundSeen" INTEGER NOT NULL DEFAULT 0,
    "known" BOOLEAN NOT NULL DEFAULT false,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabReview" (
    "id" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,

    CONSTRAINT "VocabReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VocabCard_deckId_state_due_idx" ON "VocabCard"("deckId", "state", "due");

-- CreateIndex
CREATE INDEX "VocabCard_deckId_position_idx" ON "VocabCard"("deckId", "position");

-- CreateIndex
CREATE INDEX "VocabReview_deckId_at_idx" ON "VocabReview"("deckId", "at");

-- CreateIndex
CREATE INDEX "VocabReview_at_idx" ON "VocabReview"("at");

-- AddForeignKey
ALTER TABLE "VocabCard" ADD CONSTRAINT "VocabCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "VocabDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabReview" ADD CONSTRAINT "VocabReview_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "VocabDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabReview" ADD CONSTRAINT "VocabReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VocabCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
