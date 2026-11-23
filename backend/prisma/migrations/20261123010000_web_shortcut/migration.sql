-- CreateTable
CREATE TABLE "WebShortcut" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebShortcut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebShortcut_position_idx" ON "WebShortcut"("position");
