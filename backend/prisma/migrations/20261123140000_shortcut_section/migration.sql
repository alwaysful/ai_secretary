-- AlterTable
ALTER TABLE "WebShortcut" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'lobby';

-- DropIndex
DROP INDEX "WebShortcut_position_idx";

-- CreateIndex
CREATE INDEX "WebShortcut_section_position_idx" ON "WebShortcut"("section", "position");
