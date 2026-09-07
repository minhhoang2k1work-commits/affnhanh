-- Additive publishing manager migration. Run once against the existing AFF database.
BEGIN;
-- AlterTable
ALTER TABLE "ExtensionDevice" ADD COLUMN     "publishingLastSeenAt" TIMESTAMP(3),
ADD COLUMN     "publishingLease" TEXT,
ADD COLUMN     "publishingLeaseUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PublishingChannel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT true,
    "slots" JSONB NOT NULL DEFAULT '["09:00","19:00"]',
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" JSONB NOT NULL DEFAULT '[]',
    "affiliateUrl" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "permalink" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingEvent" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishingChannel_deviceId_paused_idx" ON "PublishingChannel"("deviceId", "paused");

-- CreateIndex
CREATE UNIQUE INDEX "PublishingChannel_userId_pageId_key" ON "PublishingChannel"("userId", "pageId");

-- CreateIndex
CREATE INDEX "PublishingPost_status_scheduledAt_idx" ON "PublishingPost"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PublishingPost_channelId_scheduledAt_idx" ON "PublishingPost"("channelId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublishingPost_userId_clientKey_key" ON "PublishingPost"("userId", "clientKey");

-- CreateIndex
CREATE INDEX "PublishingEvent_postId_createdAt_idx" ON "PublishingEvent"("postId", "createdAt");

-- AddForeignKey
ALTER TABLE "PublishingChannel" ADD CONSTRAINT "PublishingChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingChannel" ADD CONSTRAINT "PublishingChannel_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ExtensionDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingPost" ADD CONSTRAINT "PublishingPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingPost" ADD CONSTRAINT "PublishingPost_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PublishingChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingEvent" ADD CONSTRAINT "PublishingEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PublishingPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
