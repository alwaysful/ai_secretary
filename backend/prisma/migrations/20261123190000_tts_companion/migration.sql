ALTER TABLE "Conversation" ADD COLUMN "persona" TEXT;
CREATE INDEX "Conversation_persona_idx" ON "Conversation"("persona");

ALTER TABLE "AppSettings" ADD COLUMN "ttsEngine" TEXT NOT NULL DEFAULT 'browser';
ALTER TABLE "AppSettings" ADD COLUMN "ttsModel" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "ttsVoice" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "ttsRate" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "AppSettings" ADD COLUMN "ttsAutoRead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "companionPrompt" TEXT;
