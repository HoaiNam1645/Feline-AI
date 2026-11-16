import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { AgentRunStatus, ChatAnswerability, ChatMessageRole, ChatMessageStatus, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AccessProfile } from "../auth/access-control";
import { KnowledgeDelegationService } from "../agents/delegation/knowledge-delegation.service";
import { AiOperationsControlService } from "../operations/ai-operations-control.service";
import { CeoHrAnswerService } from "./ceo-hr-answer.service";
import { CeoMemoryService } from "./ceo-memory.service";

const AGENT_ID = "ceo-ai";
const CAPABILITY_ID = "ceo.hr.ask";

@Injectable()
export class CeoChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly answers: CeoHrAnswerService,
    private readonly operations: AiOperationsControlService,
    private readonly memory: CeoMemoryService,
    private readonly moduleRef: ModuleRef
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
    if (this.shouldDelegateToTiktok(question)) {
      return this.answerDelegated(actor, conversation, conversationId, question, signal, includeUsage, onTextDelta, retryPair);
    }
    const retryIds = retryPair ? [retryPair.userMessageId, retryPair.assistantMessageId] : [];
    const history = conversation.messages.filter((message) => !retryIds.includes(message.id)).filter((message) => message.status === ChatMessageStatus.COMPLETED).slice(-10).map((message) => ({ role: message.role === ChatMessageRole.USER ? "user" as const : "assistant" as const, content: message.content }));
    const recalledMemories = await this.memory.recall(actor.id, AGENT_ID, question, conversationId);
    const operation = await this.operations.start({ userId: actor.id, agentId: AGENT_ID, capabilityId: CAPABILITY_ID, conversationId, question });
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
      const run = await this.prisma.agentRun.create({ data: { agentId: AGENT_ID, capabilityId: CAPABILITY_ID, status: AgentRunStatus.RUNNING, input: { question }, actorUserId: actor.id, conversationId, operationAuditId: operation.auditId } });
      const output = await this.answers.answer(actor, question, history, signal, onTextDelta, recalledMemories);
      const completedRun = await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.COMPLETED,
          output: output as unknown as Prisma.InputJsonValue,
          model: output.usage.model,
          promptVersion: "ceo-hr-qa-v2",
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
      await this.memory.refresh(actor.id, AGENT_ID, conversationId);
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

  private async answerDelegated(
    actor: { id: string; role: UserRole; departmentCode: string | null; access: AccessProfile },
    conversation: Awaited<ReturnType<CeoChatService["getConversation"]>>,
    conversationId: string,
    question: string,
    signal?: AbortSignal,
    includeUsage = false,
    onTextDelta?: (text: string) => void,
    retryPair?: { userMessageId: string; assistantMessageId: string; assistantCreatedAt: Date } | null
  ) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const [userMessage, assistantMessage] = await this.prisma.$transaction(async (tx) => {
      if (retryPair) {
        await tx.chatQuestionEvaluation.deleteMany({ where: { OR: [{ userMessageId: retryPair.userMessageId }, { assistantMessageId: retryPair.assistantMessageId }] } });
        await tx.chatMessage.delete({ where: { id: retryPair.assistantMessageId } });
      }
      const user = retryPair
        ? await tx.chatMessage.findUniqueOrThrow({ where: { id: retryPair.userMessageId } })
        : await tx.chatMessage.create({ data: { conversationId, role: ChatMessageRole.USER, status: ChatMessageStatus.COMPLETED, content: question } });
      const assistant = await tx.chatMessage.create({ data: { conversationId, role: ChatMessageRole.ASSISTANT, status: ChatMessageStatus.PENDING, content: "", createdAt: retryPair?.assistantCreatedAt } });
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { title: conversation.messages.length ? conversation.title : question.replace(/\s+/g, " ").slice(0, 72), updatedAt: new Date() }
      });
      return [user, assistant] as const;
    });
    try {
      const delegations = this.moduleRef.get(KnowledgeDelegationService, { strict: false });
      const result = await delegations.delegate(actor, AGENT_ID, "tiktok-ai", question, onTextDelta);
      const completedMessage = await this.prisma.chatMessage.update({
        where: { id: assistantMessage.id },
        data: {
          status: ChatMessageStatus.COMPLETED,
          content: result.answerMarkdown,
          sources: result.sources as unknown as Prisma.InputJsonValue,
          suggestions: result.suggestions as unknown as Prisma.InputJsonValue,
          agentRunId: result.runId
        }
      });
      await this.prisma.chatQuestionEvaluation.create({
        data: {
          userId: actor.id,
          conversationId,
          userMessageId: userMessage.id,
          assistantMessageId: completedMessage.id,
          agentRunId: result.runId,
          agentId: "tiktok-ai",
          question,
          answer: result.answerMarkdown,
          classification: result.answerability.status as ChatAnswerability,
          reasonCode: result.answerability.reasonCode,
          reason: result.answerability.reason
        }
      });
      await this.memory.refresh(actor.id, AGENT_ID, conversationId);
      return {
        userMessage,
        assistantMessage: { ...completedMessage, usage: includeUsage ? result.usage : null },
        output: {
          markdown: result.answerMarkdown,
          sources: result.sources,
          suggestedQuestions: result.suggestions,
          answerability: result.answerability,
          usage: result.usage
        },
        runId: result.runId
      };
    } catch (error) {
      await this.prisma.chatMessage.update({
        where: { id: assistantMessage.id },
        data: { status: ChatMessageStatus.FAILED, error: error instanceof Error ? error.message.slice(0, 1000) : "Không thể chuyển câu hỏi", content: "Không thể hoàn tất câu trả lời. Vui lòng thử lại." }
      });
      throw error;
    }
  }

  private shouldDelegateToTiktok(question: string): boolean {
    const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /\b(tiktok|seller center|livestream|live stream|video ngan|shop tiktok|don tiktok|quang cao tiktok)\b/.test(normalized);
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
