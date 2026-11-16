CREATE TYPE "ChatMessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "ChatMessageStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "ChatConversation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" "ChatMessageRole" NOT NULL,
  "status" "ChatMessageStatus" NOT NULL DEFAULT 'PENDING',
  "content" TEXT NOT NULL,
  "reportDate" TEXT,
  "agentRunId" TEXT,
  "sources" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatConversation_userId_updatedAt_idx" ON "ChatConversation"("userId", "updatedAt");
CREATE INDEX "ChatConversation_agentId_updatedAt_idx" ON "ChatConversation"("agentId", "updatedAt");
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
CREATE INDEX "ChatMessage_agentRunId_idx" ON "ChatMessage"("agentRunId");

ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
