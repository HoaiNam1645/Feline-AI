CREATE TABLE "ConversationMemory" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "embedding" JSONB NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "messageCount" INTEGER NOT NULL,
  "lastMessageAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConversationMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationMemory_conversationId_key" ON "ConversationMemory"("conversationId");
CREATE INDEX "ConversationMemory_userId_agentId_updatedAt_idx" ON "ConversationMemory"("userId", "agentId", "updatedAt");
CREATE INDEX "ConversationMemory_agentId_updatedAt_idx" ON "ConversationMemory"("agentId", "updatedAt");

ALTER TABLE "ConversationMemory"
  ADD CONSTRAINT "ConversationMemory_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationMemory"
  ADD CONSTRAINT "ConversationMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
