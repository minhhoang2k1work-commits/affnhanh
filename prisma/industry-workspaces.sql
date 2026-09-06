CREATE TABLE IF NOT EXISTS "IndustryWorkspace" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "basePrompt" TEXT NOT NULL DEFAULT '',
  "referenceLinks" JSONB NOT NULL DEFAULT '[]',
  "chatgptUrl" TEXT NOT NULL DEFAULT 'https://chatgpt.com/',
  "flowUrl" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "IndustryWorkspace_userId_name_key" ON "IndustryWorkspace"("userId", "name");
