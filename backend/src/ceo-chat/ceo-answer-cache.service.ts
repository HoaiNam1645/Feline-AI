import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { createClient, RedisClientType } from "redis";
import { requiredNumber, requiredString } from "../config/runtime-config";
import { PrismaService } from "../database/prisma.service";
import { KnowledgeEmbeddingService } from "../knowledge/knowledge-embedding.service";
import type { CeoHrAnswer } from "./ceo-hr-answer.service";

interface CacheContext {
  agentId: string;
  capabilityId: string;
  scopeKey: string;
  knowledgeFingerprint: string;
  promptVersion: string;
  question: string;
}

@Injectable()
export class CeoAnswerCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CeoAnswerCacheService.name);
  private redis: RedisClientType | null = null;
  private redisUnavailable = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: KnowledgeEmbeddingService
  ) {}

  isEligible(question: string): boolean {
    const normalized = this.normalize(question);
    if (normalized.length < 8) return false;
    return !/\b(tao|gui|cap nhat|xoa|phe duyet|tu choi|xac nhan|thuc hien|dat lich|huy|chuyen khoan)\b/.test(normalized);
  }

  async get(context: CacheContext): Promise<CeoHrAnswer | null> {
    const normalizedQuestion = this.normalize(context.question);
    const exactHash = this.exactHash(context, normalizedQuestion);
    const redisValue = await this.redisGet(exactHash);
    if (redisValue) return this.cachedAnswer(redisValue);

    const now = new Date();
    const candidates = await this.prisma.ceoAnswerCache.findMany({
      where: {
        agentId: context.agentId,
        capabilityId: context.capabilityId,
        scopeKey: context.scopeKey,
        knowledgeFingerprint: context.knowledgeFingerprint,
        promptVersion: context.promptVersion,
        expiresAt: { gt: now }
      },
      orderBy: { lastHitAt: "desc" },
      take: 80
    });
    const queryVector = this.embeddings.embed(this.semanticQuestion(normalizedQuestion));
    const best = candidates
      .map((candidate) => ({
        candidate,
        score: this.embeddings.similarity(queryVector, this.numberArray(candidate.questionEmbedding))
      }))
      .filter((item) => item.score >= 0.78)
      .sort((left, right) => right.score - left.score)[0];
    if (!best) return null;

    const answer = best.candidate.answer as unknown as CeoHrAnswer;
    await this.prisma.ceoAnswerCache.update({
      where: { id: best.candidate.id },
      data: { hitCount: { increment: 1 }, lastHitAt: now }
    });
    await this.redisSet(exactHash, answer);
    return this.cachedAnswer(answer);
  }

  async put(context: CacheContext, answer: CeoHrAnswer): Promise<void> {
    if (answer.answerability.status !== "ANSWERED") return;
    const normalizedQuestion = this.normalize(context.question);
    const exactHash = this.exactHash(context, normalizedQuestion);
    const ttlSeconds = requiredNumber("CEO_ANSWER_CACHE_TTL_SECONDS", 86_400);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.prisma.ceoAnswerCache.upsert({
      where: { exactHash },
      create: {
        exactHash,
        agentId: context.agentId,
        capabilityId: context.capabilityId,
        scopeKey: context.scopeKey,
        knowledgeFingerprint: context.knowledgeFingerprint,
        promptVersion: context.promptVersion,
        normalizedQuestion,
        questionEmbedding: this.embeddings.embed(this.semanticQuestion(normalizedQuestion)),
        answer: answer as unknown as Prisma.InputJsonValue,
        expiresAt
      },
      update: {
        questionEmbedding: this.embeddings.embed(this.semanticQuestion(normalizedQuestion)),
        answer: answer as unknown as Prisma.InputJsonValue,
        expiresAt
      }
    });
    await this.redisSet(exactHash, answer);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis?.isOpen) await this.redis.quit().catch(() => undefined);
  }

  private cachedAnswer(answer: CeoHrAnswer): CeoHrAnswer {
    return {
      ...answer,
      usage: { model: "answer-cache", inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
    };
  }

  private normalize(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  private semanticQuestion(normalized: string): string {
    const withoutBoilerplate = normalized
      .replace(/\b(nhu the nao|lam the nao|ra sao|la gi|gom nhung buoc nao|gom cac buoc nao)\b/g, " ")
      .replace(/\b(quy trinh|cac buoc|huong dan|thuc hien|toi|minh|muon|can|de|thi|giup)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return withoutBoilerplate || normalized;
  }

  private exactHash(context: CacheContext, normalizedQuestion: string): string {
    return createHash("sha256").update(JSON.stringify({
      agentId: context.agentId,
      capabilityId: context.capabilityId,
      scopeKey: context.scopeKey,
      knowledgeFingerprint: context.knowledgeFingerprint,
      promptVersion: context.promptVersion,
      normalizedQuestion
    })).digest("hex");
  }

  private async redisClient(): Promise<RedisClientType | null> {
    if (this.redisUnavailable) return null;
    if (!this.redis) {
      this.redis = createClient({
        socket: {
          host: requiredString("REDIS_HOST", "127.0.0.1"),
          port: requiredNumber("REDIS_PORT", 6379),
          connectTimeout: 1200,
          reconnectStrategy: false
        }
      });
      this.redis.on("error", () => undefined);
    }
    if (!this.redis.isOpen) {
      try { await this.redis.connect(); }
      catch (error) {
        this.redisUnavailable = true;
        this.logger.warn(`Redis answer cache không khả dụng, chuyển sang PostgreSQL: ${error instanceof Error ? error.message : "unknown error"}`);
        return null;
      }
    }
    return this.redis;
  }

  private async redisGet(exactHash: string): Promise<CeoHrAnswer | null> {
    try {
      const client = await this.redisClient();
      const value = await client?.get(`ceo:answer:${exactHash}`);
      return value ? JSON.parse(value) as CeoHrAnswer : null;
    } catch { return null; }
  }

  private async redisSet(exactHash: string, answer: CeoHrAnswer): Promise<void> {
    try {
      const client = await this.redisClient();
      if (client) await client.set(`ceo:answer:${exactHash}`, JSON.stringify(answer), { EX: requiredNumber("CEO_ANSWER_CACHE_TTL_SECONDS", 86_400) });
    } catch { /* PostgreSQL remains the durable cache. */ }
  }

  private numberArray(value: unknown): number[] {
    return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
  }
}
