CREATE TYPE "ChatAnswerability" AS ENUM ('ANSWERED', 'UNANSWERED');
CREATE TYPE "ChatAnswerabilitySource" AS ENUM ('SYSTEM', 'ADMIN');

CREATE TABLE "ChatQuestionEvaluation" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "conversationId" TEXT NOT NULL,
  "userMessageId" TEXT NOT NULL,
  "assistantMessageId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "agentId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "classification" "ChatAnswerability" NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "reason" TEXT,
  "source" "ChatAnswerabilitySource" NOT NULL DEFAULT 'SYSTEM',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatQuestionEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatQuestionEvaluation_userMessageId_key" ON "ChatQuestionEvaluation"("userMessageId");
CREATE UNIQUE INDEX "ChatQuestionEvaluation_assistantMessageId_key" ON "ChatQuestionEvaluation"("assistantMessageId");
CREATE INDEX "ChatQuestionEvaluation_classification_createdAt_idx" ON "ChatQuestionEvaluation"("classification", "createdAt");
CREATE INDEX "ChatQuestionEvaluation_userId_classification_createdAt_idx" ON "ChatQuestionEvaluation"("userId", "classification", "createdAt");
CREATE INDEX "ChatQuestionEvaluation_agentId_classification_createdAt_idx" ON "ChatQuestionEvaluation"("agentId", "classification", "createdAt");

ALTER TABLE "ChatQuestionEvaluation"
ADD CONSTRAINT "ChatQuestionEvaluation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ChatQuestionEvaluation" (
  "id", "userId", "conversationId", "userMessageId", "assistantMessageId",
  "agentRunId", "agentId", "question", "answer", "classification",
  "reasonCode", "reason", "source", "createdAt", "updatedAt"
)
SELECT
  'backfill_' || md5(assistant."id"),
  conversation."userId",
  assistant."conversationId",
  question."id",
  assistant."id",
  assistant."agentRunId",
  conversation."agentId",
  question."content",
  assistant."content",
  CASE
    WHEN assistant."content" ILIKE ANY (ARRAY[
      '%không bao gồm%', '%không tìm thấy%', '%chưa đủ dữ liệu%',
      '%chưa có dữ liệu%', '%chưa được cấp quyền%', '%không thể kết luận%',
      '%vui lòng cung cấp%', '%vui lòng nhập%', '%kiểm tra lại%'
    ]) THEN 'UNANSWERED'::"ChatAnswerability"
    ELSE 'ANSWERED'::"ChatAnswerability"
  END,
  CASE
    WHEN assistant."content" ILIKE ANY (ARRAY[
      '%không bao gồm%', '%không tìm thấy%', '%chưa đủ dữ liệu%',
      '%chưa có dữ liệu%', '%chưa được cấp quyền%', '%không thể kết luận%',
      '%vui lòng cung cấp%', '%vui lòng nhập%', '%kiểm tra lại%'
    ]) THEN 'HISTORICAL_INSUFFICIENT_DATA'
    ELSE 'HISTORICAL_ANSWERED'
  END,
  CASE
    WHEN assistant."content" ILIKE ANY (ARRAY[
      '%không bao gồm%', '%không tìm thấy%', '%chưa đủ dữ liệu%',
      '%chưa có dữ liệu%', '%chưa được cấp quyền%', '%không thể kết luận%',
      '%vui lòng cung cấp%', '%vui lòng nhập%', '%kiểm tra lại%'
    ]) THEN 'Câu trả lời lịch sử cho thấy dữ liệu chưa đủ hoặc cần bổ sung thông tin.'
    ELSE 'Câu trả lời lịch sử đã cung cấp được kết quả.'
  END,
  'SYSTEM'::"ChatAnswerabilitySource",
  assistant."createdAt",
  NOW()
FROM "ChatMessage" assistant
INNER JOIN "ChatConversation" conversation ON conversation."id" = assistant."conversationId"
INNER JOIN LATERAL (
  SELECT user_message."id", user_message."content"
  FROM "ChatMessage" user_message
  WHERE user_message."conversationId" = assistant."conversationId"
    AND user_message."role" = 'USER'
    AND user_message."createdAt" <= assistant."createdAt"
  ORDER BY user_message."createdAt" DESC, user_message."id" DESC
  LIMIT 1
) question ON TRUE
WHERE assistant."role" = 'ASSISTANT'
  AND assistant."status" = 'COMPLETED'
  AND assistant."content" <> ''
ON CONFLICT DO NOTHING;
