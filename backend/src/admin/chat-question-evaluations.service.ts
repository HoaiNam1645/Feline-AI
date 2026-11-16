import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ChatAnswerability, ChatAnswerabilitySource, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class ChatQuestionEvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: Record<string, unknown>) {
    const classification = typeof query.classification === "string"
      && Object.values(ChatAnswerability).includes(query.classification as ChatAnswerability)
      ? query.classification as ChatAnswerability
      : ChatAnswerability.UNANSWERED;
    const userId = typeof query.userId === "string" && query.userId ? query.userId : undefined;
    const search = typeof query.search === "string" ? query.search.trim().slice(0, 120) : "";
    const page = this.integer(query.page, 1, 1, 10_000);
    const limit = this.integer(query.limit, 30, 1, 100);
    const where: Prisma.ChatQuestionEvaluationWhereInput = {
      classification,
      ...(userId ? { userId } : {}),
      ...(search ? {
        OR: [
          { question: { contains: search, mode: "insensitive" } },
          { answer: { contains: search, mode: "insensitive" } },
          { user: { is: { displayName: { contains: search, mode: "insensitive" } } } },
          { user: { is: { email: { contains: search, mode: "insensitive" } } } }
        ]
      } : {})
    };
    const [items, total, counts, users] = await Promise.all([
      this.prisma.chatQuestionEvaluation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, displayName: true, email: true, role: true } } }
      }),
      this.prisma.chatQuestionEvaluation.count({ where }),
      this.prisma.chatQuestionEvaluation.groupBy({
        by: ["classification"],
        _count: { _all: true }
      }),
      this.prisma.user.findMany({
        where: { chatQuestionEvaluations: { some: {} } },
        select: { id: true, displayName: true, email: true, role: true },
        orderBy: { displayName: "asc" }
      })
    ]);
    const summary = Object.fromEntries(counts.map((item) => [item.classification, item._count._all]));
    return {
      items,
      total,
      page,
      limit,
      summary: {
        answered: Number(summary.ANSWERED || 0),
        unanswered: Number(summary.UNANSWERED || 0)
      },
      users
    };
  }

  async update(id: string, body: Record<string, unknown>, reviewedById: string) {
    const classification = String(body.classification || "") as ChatAnswerability;
    if (!Object.values(ChatAnswerability).includes(classification)) {
      throw new BadRequestException("Phân loại câu hỏi không hợp lệ");
    }
    const existing = await this.prisma.chatQuestionEvaluation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Không tìm thấy câu hỏi cần đánh giá");
    return this.prisma.chatQuestionEvaluation.update({
      where: { id },
      data: {
        classification,
        reasonCode: classification === ChatAnswerability.ANSWERED
          ? "ADMIN_MARKED_ANSWERED"
          : "ADMIN_MARKED_UNANSWERED",
        reason: typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim().slice(0, 500)
          : "Admin đã điều chỉnh phân loại.",
        source: ChatAnswerabilitySource.ADMIN,
        reviewedById,
        reviewedAt: new Date()
      },
      include: { user: { select: { id: true, displayName: true, email: true, role: true } } }
    });
  }

  private integer(value: unknown, fallback: number, minimum: number, maximum: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
  }
}
