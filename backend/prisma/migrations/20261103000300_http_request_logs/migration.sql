CREATE TABLE "HttpRequestLog" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "routePath" TEXT,
  "statusCode" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "userId" TEXT,
  "userRole" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "errorName" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "errorStack" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HttpRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HttpRequestLog_requestId_key" ON "HttpRequestLog"("requestId");
CREATE INDEX "HttpRequestLog_createdAt_idx" ON "HttpRequestLog"("createdAt");
CREATE INDEX "HttpRequestLog_statusCode_createdAt_idx" ON "HttpRequestLog"("statusCode", "createdAt");
CREATE INDEX "HttpRequestLog_userId_createdAt_idx" ON "HttpRequestLog"("userId", "createdAt");
