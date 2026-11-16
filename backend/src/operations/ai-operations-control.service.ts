import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable
} from "@nestjs/common";
import { AiOperationStatus, AiUsageScopeType, Prisma } from "@prisma/client";
import { requiredNumber } from "../config/runtime-config";
import { PrismaService } from "../database/prisma.service";

interface UsageScope {
  type: AiUsageScopeType;
  id: string;
  limit: number;
}

export interface AiUsageReservation {
  usageDate: Date;
  reservedTokens: number;
  scopes: UsageScope[];
}

export interface AiOperationHandle {
  auditId: string;
  reservation: AiUsageReservation;
}

interface StartOperationInput {
  userId: string;
  agentId: string;
  capabilityId: string;
  conversationId: string;
  question: string;
}

@Injectable()
export class AiOperationsControlService {
  constructor(private readonly prisma: PrismaService) {}

  async listAudits(query: Record<string, unknown>) {
    const limit = this.boundedInteger(query.limit, 50, 1, 200);
    const status = typeof query.status === "string"
      && Object.values(AiOperationStatus).includes(query.status as AiOperationStatus)
      ? query.status as AiOperationStatus
      : undefined;
    const userId = typeof query.userId === "string" && query.userId ? query.userId : undefined;
    const agentId = typeof query.agentId === "string" && query.agentId ? query.agentId : undefined;
    return this.prisma.aiOperationAudit.findMany({
      where: { status, userId, agentId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, email: true, displayName: true, role: true } }
      }
    });
  }

  async dailyUsage(query: Record<string, unknown>) {
    const usageDate = this.parseUsageDate(query.date);
    return this.prisma.aiDailyUsage.findMany({
      where: { usageDate },
      orderBy: [{ scopeType: "asc" }, { scopeId: "asc" }]
    });
  }

  async listPolicies() {
    return this.prisma.aiUsagePolicy.findMany({
      orderBy: [{ scopeType: "asc" }, { scopeId: "asc" }]
    });
  }

  async upsertPolicy(body: Record<string, unknown>) {
    const scopeType = String(body.scopeType || "") as AiUsageScopeType;
    if (!Object.values(AiUsageScopeType).includes(scopeType)) {
      throw new BadRequestException("Loại quota không hợp lệ");
    }
    const scopeId = typeof body.scopeId === "string" ? body.scopeId.trim() : "";
    if (!scopeId || scopeId.length > 120) {
      throw new BadRequestException("Đối tượng áp dụng quota không hợp lệ");
    }
    const dailyTokenLimit = Number(body.dailyTokenLimit);
    if (!Number.isInteger(dailyTokenLimit) || dailyTokenLimit < 1) {
      throw new BadRequestException("Giới hạn token/ngày phải là số nguyên dương");
    }
    if (scopeType === AiUsageScopeType.USER) {
      const user = await this.prisma.user.findUnique({ where: { id: scopeId }, select: { id: true } });
      if (!user) throw new BadRequestException("Không tìm thấy tài khoản áp dụng quota");
    }
    return this.prisma.aiUsagePolicy.upsert({
      where: { scopeType_scopeId: { scopeType, scopeId } },
      create: {
        scopeType,
        scopeId,
        dailyTokenLimit,
        isActive: body.isActive !== false
      },
      update: {
        dailyTokenLimit,
        isActive: body.isActive !== false
      }
    });
  }

  async start(input: StartOperationInput): Promise<AiOperationHandle> {
    try {
      await this.consumeRateLimit(input.userId);
      return await this.reserveQuotaAndCreateAudit(input);
    } catch (error) {
      await this.recordRejected(input, error);
      throw error;
    }
  }

  async attachMessages(
    auditId: string,
    userMessageId: string,
    assistantMessageId: string
  ): Promise<void> {
    await this.prisma.aiOperationAudit.update({
      where: { id: auditId },
      data: { userMessageId, assistantMessageId }
    });
  }

  async complete(
    handle: AiOperationHandle,
    run: {
      id: string;
      model: string | null;
      inputTokens: number | null;
      outputTokens: number | null;
      estimatedCostUsd: Prisma.Decimal | null;
      toolCalls?: unknown[];
    }
  ): Promise<void> {
    const inputTokens = run.inputTokens || 0;
    const outputTokens = run.outputTokens || 0;
    const cost = run.estimatedCostUsd === null ? 0 : Number(run.estimatedCostUsd);
    await this.prisma.$transaction(async (tx) => {
      await this.reconcileUsage(
        tx,
        handle.reservation,
        inputTokens,
        outputTokens,
        cost
      );
      await tx.aiOperationAudit.update({
        where: { id: handle.auditId },
        data: {
          status: AiOperationStatus.COMPLETED,
          agentRunId: run.id,
          model: run.model,
          inputTokens: run.inputTokens,
          outputTokens: run.outputTokens,
          estimatedCostUsd: run.estimatedCostUsd,
          toolCalls: (run.toolCalls || []) as unknown as Prisma.InputJsonValue,
          completedAt: new Date()
        }
      });
    });
  }

  async fail(handle: AiOperationHandle, error: unknown): Promise<void> {
    const run = await this.prisma.agentRun.findUnique({
      where: { operationAuditId: handle.auditId },
      include: { toolCalls: true }
    });
    await this.prisma.$transaction(async (tx) => {
      await this.releaseReservation(tx, handle.reservation);
      await tx.aiOperationAudit.update({
        where: { id: handle.auditId },
        data: {
          status: this.isAbortError(error)
            ? AiOperationStatus.CANCELED
            : AiOperationStatus.FAILED,
          agentRunId: run?.id,
          model: run?.model,
          inputTokens: run?.inputTokens,
          outputTokens: run?.outputTokens,
          estimatedCostUsd: run?.estimatedCostUsd,
          toolCalls: (run?.toolCalls || []) as unknown as Prisma.InputJsonValue,
          errorCode: this.errorCode(error),
          error: this.errorMessage(error),
          completedAt: new Date()
        }
      });
    });
  }

  concurrentRequestError(): ConflictException {
    return new ConflictException(
      "Cuộc trò chuyện đang xử lý một câu hỏi khác. Vui lòng chờ câu trả lời hoàn tất."
    );
  }

  private async consumeRateLimit(userId: string): Promise<void> {
    const limit = requiredNumber("AI_RATE_LIMIT_REQUESTS", 10);
    const windowSeconds = requiredNumber("AI_RATE_LIMIT_WINDOW_SECONDS", 60);
    const now = new Date();
    const cutoff = new Date(now.getTime() - windowSeconds * 1000);
    const key = `ai:user:${userId}`;
    const rows = await this.prisma.$queryRaw<Array<{
      requestCount: number;
      windowStartedAt: Date;
    }>>(Prisma.sql`
      INSERT INTO "AiRateLimitBucket" ("key", "windowStartedAt", "requestCount", "updatedAt")
      VALUES (${key}, ${now}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "windowStartedAt" = CASE
          WHEN "AiRateLimitBucket"."windowStartedAt" <= ${cutoff} THEN ${now}
          ELSE "AiRateLimitBucket"."windowStartedAt"
        END,
        "requestCount" = CASE
          WHEN "AiRateLimitBucket"."windowStartedAt" <= ${cutoff} THEN 1
          ELSE "AiRateLimitBucket"."requestCount" + 1
        END,
        "updatedAt" = ${now}
      RETURNING "requestCount", "windowStartedAt"
    `);
    const bucket = rows[0];
    if (bucket && bucket.requestCount > limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((bucket.windowStartedAt.getTime() + windowSeconds * 1000 - now.getTime()) / 1000)
      );
      throw new HttpException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: "Bạn gửi câu hỏi quá nhanh. Vui lòng thử lại sau.",
        retryAfterSeconds: retryAfter
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async reserveQuotaAndCreateAudit(
    input: StartOperationInput
  ): Promise<AiOperationHandle> {
    const usageDate = this.todayInVietnam();
    const reservedTokens = requiredNumber("AI_CHAT_TOKEN_RESERVATION", 4000);
    const quotaEnabled = process.env.AI_DAILY_TOKEN_LIMIT_ENABLED !== "false";
    return this.prisma.$transaction(async (tx) => {
      const scopes = await this.usageScopes(tx, input.userId, input.agentId);
      for (const scope of scopes) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "AiDailyUsage" (
            "id", "usageDate", "scopeType", "scopeId", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${usageDate}, ${scope.type}::"AiUsageScopeType", ${scope.id}, NOW(), NOW()
          ) ON CONFLICT ("usageDate", "scopeType", "scopeId") DO NOTHING
        `);
        const updated = quotaEnabled
          ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
              UPDATE "AiDailyUsage"
              SET "reservedTokens" = "reservedTokens" + ${reservedTokens},
                  "requestCount" = "requestCount" + 1,
                  "updatedAt" = NOW()
              WHERE "usageDate" = ${usageDate}
                AND "scopeType" = ${scope.type}::"AiUsageScopeType"
                AND "scopeId" = ${scope.id}
                AND "inputTokens" + "outputTokens" + "reservedTokens" + ${reservedTokens} <= ${scope.limit}
              RETURNING "id"
            `)
          : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
              UPDATE "AiDailyUsage"
              SET "reservedTokens" = "reservedTokens" + ${reservedTokens},
                  "requestCount" = "requestCount" + 1,
                  "updatedAt" = NOW()
              WHERE "usageDate" = ${usageDate}
                AND "scopeType" = ${scope.type}::"AiUsageScopeType"
                AND "scopeId" = ${scope.id}
              RETURNING "id"
            `);
        if (!updated.length) {
          throw new HttpException(
            "Đã đạt giới hạn sử dụng AI trong ngày. Vui lòng liên hệ quản trị viên.",
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
      }
      const audit = await tx.aiOperationAudit.create({
        data: {
          userId: input.userId,
          agentId: input.agentId,
          capabilityId: input.capabilityId,
          conversationId: input.conversationId,
          question: input.question,
          metadata: {
            timeoutMs: requiredNumber("AI_CHAT_TIMEOUT_MS", 45_000),
            maxRetries: this.nonNegativeNumber("AI_PROVIDER_MAX_RETRIES", 2),
            reservedTokens,
            quotaEnabled
          }
        }
      });
      return {
        auditId: audit.id,
        reservation: { usageDate, reservedTokens, scopes }
      };
    });
  }

  private async usageScopes(
    tx: Prisma.TransactionClient,
    userId: string,
    agentId: string
  ): Promise<UsageScope[]> {
    const policies = await tx.aiUsagePolicy.findMany({
      where: {
        isActive: true,
        OR: [
          { scopeType: AiUsageScopeType.USER, scopeId: userId },
          { scopeType: AiUsageScopeType.AGENT, scopeId: agentId }
        ]
      }
    });
    const limits = new Map(policies.map((item) => [`${item.scopeType}:${item.scopeId}`, item.dailyTokenLimit]));
    return [
      {
        type: AiUsageScopeType.USER,
        id: userId,
        limit: limits.get(`${AiUsageScopeType.USER}:${userId}`)
          || requiredNumber("AI_DAILY_TOKEN_LIMIT_PER_USER", 50_000)
      },
      {
        type: AiUsageScopeType.AGENT,
        id: agentId,
        limit: limits.get(`${AiUsageScopeType.AGENT}:${agentId}`)
          || requiredNumber("AI_DAILY_TOKEN_LIMIT_PER_AGENT", 500_000)
      }
    ];
  }

  private async reconcileUsage(
    tx: Prisma.TransactionClient,
    reservation: AiUsageReservation,
    inputTokens: number,
    outputTokens: number,
    cost: number
  ): Promise<void> {
    for (const scope of reservation.scopes) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "AiDailyUsage"
        SET "reservedTokens" = GREATEST(0, "reservedTokens" - ${reservation.reservedTokens}),
            "inputTokens" = "inputTokens" + ${inputTokens},
            "outputTokens" = "outputTokens" + ${outputTokens},
            "estimatedCostUsd" = "estimatedCostUsd" + ${cost},
            "updatedAt" = NOW()
        WHERE "usageDate" = ${reservation.usageDate}
          AND "scopeType" = ${scope.type}::"AiUsageScopeType"
          AND "scopeId" = ${scope.id}
      `);
    }
  }

  private async releaseReservation(
    tx: Prisma.TransactionClient,
    reservation: AiUsageReservation
  ): Promise<void> {
    for (const scope of reservation.scopes) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "AiDailyUsage"
        SET "reservedTokens" = GREATEST(0, "reservedTokens" - ${reservation.reservedTokens}),
            "updatedAt" = NOW()
        WHERE "usageDate" = ${reservation.usageDate}
          AND "scopeType" = ${scope.type}::"AiUsageScopeType"
          AND "scopeId" = ${scope.id}
      `);
    }
  }

  private async recordRejected(input: StartOperationInput, error: unknown): Promise<void> {
    await this.prisma.aiOperationAudit.create({
      data: {
        userId: input.userId,
        agentId: input.agentId,
        capabilityId: input.capabilityId,
        conversationId: input.conversationId,
        question: input.question,
        status: AiOperationStatus.REJECTED,
        errorCode: this.errorCode(error),
        error: this.errorMessage(error),
        completedAt: new Date()
      }
    });
  }

  private todayInVietnam(): Date {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    return new Date(`${day}T00:00:00.000Z`);
  }

  private errorCode(error: unknown): string {
    if (error instanceof HttpException) return String(error.getStatus());
    if (this.isAbortError(error)) return "CANCELED";
    return error instanceof Error ? error.name.slice(0, 100) : "UNKNOWN";
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message.slice(0, 1000);
    return "Không xác định được lỗi";
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error
      && (error.name === "AbortError" || /abort|cancel/i.test(error.message));
  }

  private nonNegativeNumber(name: string, fallback: number): number {
    const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
    return value;
  }

  private boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
  }

  private parseUsageDate(value: unknown): Date {
    if (value === undefined || value === "") return this.todayInVietnam();
    const text = String(value);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException("Ngày sử dụng phải có định dạng YYYY-MM-DD");
    }
    const date = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Ngày sử dụng không hợp lệ");
    return date;
  }
}
