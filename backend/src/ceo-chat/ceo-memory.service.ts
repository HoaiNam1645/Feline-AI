import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { KnowledgeEmbeddingService } from "../knowledge/knowledge-embedding.service";

export interface RecalledConversationMemory {
  conversationId: string;
  summary: string;
  score: number;
  updatedAt: Date;
}

@Injectable()
export class CeoMemoryService {
  private readonly logger = new Logger(CeoMemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: KnowledgeEmbeddingService
  ) {}

  async recall(
    userId: string,
    agentId: string,
    question: string,
    excludeConversationId: string,
    limit = 3
  ): Promise<RecalledConversationMemory[]> {
    const memories = await this.prisma.conversationMemory.findMany({
      where: { userId, agentId, conversationId: { not: excludeConversationId } },
      orderBy: { updatedAt: "desc" },
      take: 80
    });
    const queryVector = this.embeddings.embed(question);
    const ranked = memories
      .map((memory) => ({
        conversationId: memory.conversationId,
        summary: memory.summary,
        score: this.embeddings.similarity(queryVector, this.numberArray(memory.embedding)),
        updatedAt: memory.updatedAt
      }))
      .filter((memory) => memory.score >= 0.16)
      .sort((left, right) => right.score - left.score || right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, Math.max(0, Math.min(limit, 3)));
    if (ranked.length || !this.isContextualFollowUp(question) || !memories.length) return ranked;
    const latest = memories[0];
    return [{
      conversationId: latest.conversationId,
      summary: latest.summary,
      score: 0,
      updatedAt: latest.updatedAt
    }];
  }

  async refresh(userId: string, agentId: string, conversationId: string): Promise<void> {
    try {
      const messages = await this.prisma.chatMessage.findMany({
        where: { conversationId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 12
      });
      if (messages.length < 2) return;
      const ordered = messages.reverse();
      const summary = ordered
        .map((message) => `${message.role === "USER" ? "Người dùng" : "CEO AI"}: ${this.compact(message.content, 520)}`)
        .join("\n")
        .slice(-4200);
      const lastMessageAt = ordered[ordered.length - 1].createdAt;
      await this.prisma.conversationMemory.upsert({
        where: { conversationId },
        create: {
          conversationId,
          userId,
          agentId,
          summary,
          embedding: this.embeddings.embed(summary),
          embeddingModel: this.embeddings.model,
          messageCount: ordered.length,
          lastMessageAt
        },
        update: {
          summary,
          embedding: this.embeddings.embed(summary),
          embeddingModel: this.embeddings.model,
          messageCount: ordered.length,
          lastMessageAt
        }
      });
    } catch (error) {
      this.logger.warn(`Không thể cập nhật memory cho hội thoại ${conversationId}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  private compact(value: string, limit: number): string {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
  }

  private isContextualFollowUp(question: string): boolean {
    const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /\b(con|do|no|nhu tren|truong hop nay|truong hop do|tiep theo|vay thi|the thi)\b/.test(normalized);
  }

  private numberArray(value: unknown): number[] {
    return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
  }
}
