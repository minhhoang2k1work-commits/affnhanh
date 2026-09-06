CREATE TABLE IF NOT EXISTS "TelegramCommand" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "telegramUserId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "reply" TEXT,
  "replySentAt" TIMESTAMP(3),
  "jobId" TEXT,
  "scanJobId" TEXT,
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TelegramCommand_userId_createdAt_idx" ON "TelegramCommand"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "TelegramCommand_notifiedAt_idx" ON "TelegramCommand"("notifiedAt");
