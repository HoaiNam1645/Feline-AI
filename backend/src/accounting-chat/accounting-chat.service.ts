import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AgentRunStatus, ChatAnswerability, ChatMessageRole, ChatMessageStatus, Prisma, UserRole } from "@prisma/client";
import { basicConversationReply, emitBasicConversation } from "../agents/basic-conversation";
import { AccessProfile } from "../auth/access-control";
import { CeoMemoryService } from "../ceo-chat/ceo-memory.service";
import { PrismaService } from "../database/prisma.service";
import { AiOperationsControlService } from "../operations/ai-operations-control.service";
import { AccountingKnowledgeAnswerService } from "./accounting-knowledge-answer.service";
import { AccountingDataAnswerService } from "../accounting-data/accounting-data-answer.service";

const AGENT_ID = "accounting-ai";
const KNOWLEDGE_CAPABILITY_ID = "accounting.knowledge.ask";
const DATA_CAPABILITY_ID = "accounting.data.ask";

@Injectable()
export class AccountingChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly answers: AccountingKnowledgeAnswerService,
    private readonly operations: AiOperationsControlService,
    private readonly memory: CeoMemoryService,
    private readonly dataAnswers: AccountingDataAnswerService
  ) {}

  listConversations(userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { userId, agentId: AGENT_ID },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { messages: true } } }
    });
  }

  createConversation(userId: string, title?: unknown) {
    const normalized = typeof title === "string" && title.trim() ? title.trim().slice(0, 100) : "Cuộc trò chuyện mới";
    return this.prisma.chatConversation.create({ data: { userId, agentId: AGENT_ID, title: normalized } });
  }

  async getConversation(userId: string, conversationId: string, includeUsage = false) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId, agentId: AGENT_ID },
      include: { messages: { orderBy: [{ createdAt: "asc" }, { role: "asc" }] } }
    });
    if (!conversation) throw new NotFoundException("Không tìm thấy cuộc trò chuyện");
    if (!includeUsage) return conversation;
    const runIds = conversation.messages.flatMap((message) => message.agentRunId ? [message.agentRunId] : []);
    const runs = runIds.length ? await this.prisma.agentRun.findMany({ where: { id: { in: runIds } } }) : [];
    const usage = new Map(runs.map((run) => [run.id, {
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      estimatedCostUsd: run.estimatedCostUsd === null ? null : Number(run.estimatedCostUsd),
      responseTimeMs: run.completedAt ? run.completedAt.getTime() - run.startedAt.getTime() : null
    }]));
    return { ...conversation, messages: conversation.messages.map((message) => ({ ...message, usage: message.agentRunId ? usage.get(message.agentRunId) || null : null })) };
  }

  async renameConversation(userId: string, conversationId: string, title: unknown) {
    await this.getConversation(userId, conversationId);
    const normalized = typeof title === "string" ? title.trim() : "";
    if (!normalized || normalized.length > 100) throw new BadRequestException("Tên cuộc trò chuyện phải có từ 1 đến 100 ký tự");
    return this.prisma.chatConversation.update({ where: { id: conversationId }, data: { title: normalized } });
  }

  async deleteConversation(userId: string, conversationId: string) {
    await this.getConversation(userId, conversationId);
    await this.prisma.chatConversation.delete({ where: { id: conversationId } });
    return { success: true };
  }

  async answer(
    actor: { id: string; role: UserRole; departmentCode: string | null; access: AccessProfile },
    conversationId: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
    includeUsage = false,
    onTextDelta?: (text: string) => void
  ) {
    const conversation = await this.getConversation(actor.id, conversationId);
    const question = typeof body.content === "string" ? body.content.trim() : "";
    if (!question || question.length > 2000) throw new BadRequestException("Câu hỏi phải có từ 1 đến 2000 ký tự");
    const retryAssistantMessageId = typeof body.retryAssistantMessageId === "string" ? body.retryAssistantMessageId : null;
    const retryPair = retryAssistantMessageId ? this.retryPair(conversation.messages, retryAssistantMessageId, question) : null;
    if (retryAssistantMessageId && !retryPair) throw new BadRequestException("Không tìm thấy câu trả lời phù hợp để thử lại");
    const basicReply = basicConversationReply(question, {
      name: "Kế toán AI",
      domain: "Phòng Kế toán",
      capabilitySummary: "tra cứu quy trình kế toán và phân tích dữ liệu thu chi, yêu cầu mua hàng, tài khoản, công nợ hoặc quy đổi tiền trong phạm vi bạn được phép xem",
      suggestions: [
        "Tổng thu chi tháng này là bao nhiêu?",
        "Có bao nhiêu yêu cầu mua hàng đang chờ duyệt?",
        "Công nợ chưa thu hiện còn bao nhiêu?"
      ]
    });
    const retryIds = retryPair ? [retryPair.userMessageId, retryPair.assistantMessageId] : [];
    const history = conversation.messages
      .filter((message) => !retryIds.includes(message.id))
      .filter((message) => message.status === ChatMessageStatus.COMPLETED)
      .slice(-10)
      .map((message) => ({ role: message.role === ChatMessageRole.USER ? "user" as const : "assistant" as const, content: message.content }));
    const route = basicReply ? { kind: "knowledge" as const } : this.dataAnswers.route(question);
    const capabilityId = route.kind === "data" ? DATA_CAPABILITY_ID : KNOWLEDGE_CAPABILITY_ID;
    this.assertRouteAccess(actor, route.kind === "data" ? route.domain : undefined);
    const recalledMemories = basicReply || route.kind === "data" ? [] : await this.memory.recall(actor.id, AGENT_ID, question, conversationId);
    const operation = await this.operations.start({ userId: actor.id, agentId: AGENT_ID, capabilityId, conversationId, question });
    let userMessage;
    let assistantMessage;
    try {
      [userMessage, assistantMessage] = await this.prisma.$transaction(async (tx) => {
        if (retryPair) {
          await tx.chatQuestionEvaluation.deleteMany({ where: { OR: [{ userMessageId: retryPair.userMessageId }, { assistantMessageId: retryPair.assistantMessageId }] } });
          await tx.chatMessage.delete({ where: { id: retryPair.assistantMessageId } });
        }
        const user = retryPair
          ? await tx.chatMessage.findUniqueOrThrow({ where: { id: retryPair.userMessageId } })
          : await tx.chatMessage.create({ data: { conversationId, role: ChatMessageRole.USER, status: ChatMessageStatus.COMPLETED, content: question } });
        const assistant = await tx.chatMessage.create({ data: { conversationId, role: ChatMessageRole.ASSISTANT, status: ChatMessageStatus.PENDING, content: "", createdAt: retryPair?.assistantCreatedAt } });
        await tx.chatConversation.update({ where: { id: conversationId }, data: { title: conversation.messages.length ? conversation.title : question.replace(/\s+/g, " ").slice(0, 72), updatedAt: new Date() } });
        return [user, assistant] as const;
      });
      await this.operations.attachMessages(operation.auditId, userMessage.id, assistantMessage.id);
      const run = await this.prisma.agentRun.create({ data: { agentId: AGENT_ID, capabilityId, status: AgentRunStatus.RUNNING, input: { question, route } as unknown as Prisma.InputJsonValue, actorUserId: actor.id, conversationId, operationAuditId: operation.auditId } });
      const output = basicReply
        ? this.basicOutput(basicReply.markdown, basicReply.suggestedQuestions, onTextDelta, signal)
        : route.kind === "data"
          ? await this.dataAnswers.answer(actor, question, route, run.id, signal, onTextDelta)
          : await this.answers.answer(actor, question, history, signal, onTextDelta, recalledMemories);
      const completedRun = await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.COMPLETED,
          output: output as unknown as Prisma.InputJsonValue,
          model: output.usage.model,
          promptVersion: basicReply ? "accounting-basic-conversation-v1" : route.kind === "data" ? "accounting-data-qa-v1" : "accounting-knowledge-qa-v1",
          inputTokens: output.usage.inputTokens,
          outputTokens: output.usage.outputTokens,
          estimatedCostUsd: output.usage.estimatedCostUsd === null ? null : new Prisma.Decimal(output.usage.estimatedCostUsd),
          completedAt: new Date()
        }
      });
      await this.operations.complete(operation, completedRun);
      const completedMessage = await this.prisma.chatMessage.update({
        where: { id: assistantMessage.id },
        data: { status: ChatMessageStatus.COMPLETED, content: output.markdown, sources: output.sources as unknown as Prisma.InputJsonValue, suggestions: output.suggestedQuestions as unknown as Prisma.InputJsonValue, agentRunId: run.id }
      });
      await this.prisma.chatQuestionEvaluation.create({
        data: { userId: actor.id, conversationId, userMessageId: userMessage.id, assistantMessageId: completedMessage.id, agentRunId: run.id, agentId: AGENT_ID, question, answer: output.markdown, classification: output.answerability.status as ChatAnswerability, reasonCode: output.answerability.reasonCode, reason: output.answerability.reason }
      });
      if (!basicReply && route.kind === "knowledge") await this.memory.refresh(actor.id, AGENT_ID, conversationId);
      return { userMessage, assistantMessage: { ...completedMessage, usage: includeUsage ? output.usage : null }, output, runId: run.id };
    } catch (error) {
      if (assistantMessage) await this.prisma.chatMessage.update({ where: { id: assistantMessage.id }, data: { status: ChatMessageStatus.FAILED, error: error instanceof Error ? error.message.slice(0, 1000) : "Không thể trả lời", content: "Không thể hoàn tất câu trả lời. Vui lòng thử lại." } });
      await this.prisma.agentRun.updateMany({
        where: { operationAuditId: operation.auditId, status: AgentRunStatus.RUNNING },
        data: { status: AgentRunStatus.FAILED, error: error instanceof Error ? error.message.slice(0, 1000) : "Không thể trả lời", completedAt: new Date() }
      });
      await this.operations.fail(operation, error);
      throw error;
    }
  }

  private basicOutput(markdown: string, suggestedQuestions: string[], onTextDelta?: (text: string) => void, signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    emitBasicConversation(markdown, onTextDelta);
    return {
      markdown,
      sources: [],
      suggestedQuestions,
      answerability: { status: "ANSWERED" as const, reasonCode: "BASIC_CONVERSATION", reason: null },
      usage: { model: null, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null }
    };
  }

  private retryPair(
    messages: Array<{ id: string; role: ChatMessageRole; status: ChatMessageStatus; content: string; createdAt: Date }>,
    assistantMessageId: string,
    question: string
  ): { userMessageId: string; assistantMessageId: string; assistantCreatedAt: Date } | null {
    const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
    const assistant = messages[assistantIndex];
    if (assistantIndex < 1 || assistant?.role !== ChatMessageRole.ASSISTANT || assistant.status === ChatMessageStatus.PENDING) return null;
    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      const user = messages[index];
      if (user.role !== ChatMessageRole.USER) continue;
      if (user.content.trim() !== question.trim()) return null;
      return { userMessageId: user.id, assistantMessageId: assistant.id, assistantCreatedAt: assistant.createdAt };
    }
    return null;
  }

  private assertRouteAccess(
    actor: { role: UserRole; access: AccessProfile },
    dataDomain?: string
  ): void {
    if (actor.access.platformAdmin || actor.role === UserRole.ADMIN) return;
    const grant = actor.access.grants.find((item) => item.agentId === AGENT_ID && ((item.actions as string[]).includes("*") || item.actions.includes("run")));
    const capabilityId = dataDomain ? DATA_CAPABILITY_ID : KNOWLEDGE_CAPABILITY_ID;
    if (!grant || (!grant.capabilityIds.includes("*") && !grant.capabilityIds.includes(capabilityId))) {
      throw new ForbiddenException("Bạn không có quyền sử dụng chức năng này của Kế toán AI");
    }
    const requiredScopes = dataDomain
      ? ["accounting.data.all", `accounting.data.${dataDomain}`]
      : ["accounting.knowledge"];
    if (!grant.dataScopeIds.includes("*") && !requiredScopes.some((scope) => grant.dataScopeIds.includes(scope))) {
      throw new ForbiddenException("Bạn không có quyền đọc phạm vi dữ liệu này");
    }
  }
}
