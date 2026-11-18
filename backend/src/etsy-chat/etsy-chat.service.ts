import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AgentRunStatus, ChatAnswerability, ChatMessageRole, ChatMessageStatus, Prisma, UserRole } from "@prisma/client";
import { basicConversationReply, emitBasicConversation } from "../agents/basic-conversation";
import { AccessProfile } from "../auth/access-control";
import { CeoMemoryService } from "../ceo-chat/ceo-memory.service";
import { PrismaService } from "../database/prisma.service";
import { AiOperationsControlService } from "../operations/ai-operations-control.service";
import { EtsyKnowledgeAnswerService } from "./etsy-knowledge-answer.service";
import { EtsyDataAnswerService } from "../etsy-data/etsy-data-answer.service";

const AGENT_ID = "etsy-ai";
const KNOWLEDGE_CAPABILITY_ID = "etsy.knowledge.ask";
const DATA_CAPABILITY_ID = "etsy.data.ask";

@Injectable()
export class EtsyChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly answers: EtsyKnowledgeAnswerService,
    private readonly operations: AiOperationsControlService,
    private readonly memory: CeoMemoryService,
    private readonly dataAnswers: EtsyDataAnswerService
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
      name: "Etsy AI",
      domain: "phòng Sell Etsy",
      capabilitySummary: "tra cứu quy trình và tri thức của phòng Sell Etsy trong phạm vi bạn được phép xem",
      suggestions: [
        "Quy trình tạo và duyệt listing Etsy như thế nào?",
        "Khi shop Etsy gặp vấn đề thì cần báo cho ai?"
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
          promptVersion: basicReply ? "etsy-basic-conversation-v1" : route.kind === "data" ? "etsy-data-qa-v1" : "etsy-knowledge-qa-v1",
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
}
