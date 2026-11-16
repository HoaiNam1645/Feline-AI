import {
  BadRequestException,
  Injectable,
  NotFoundException,
  RequestTimeoutException
} from "@nestjs/common";
import { ChatAnswerability, ChatMessageRole, ChatMessageStatus, Prisma } from "@prisma/client";
import { LemiexAgentService } from "../agents/lemiex-agent.service";
import { LemiexQuestionAnswer } from "../agents/capabilities/operations-question-answer.capability";
import { reportWindow, shiftReportDate } from "../metrics/report-window";
import { PrismaService } from "../database/prisma.service";
import { requiredNumber } from "../config/runtime-config";
import {
  AiOperationsControlService
} from "../operations/ai-operations-control.service";
import { ChatAttachmentService } from "./chat-attachment.service";

const AGENT_ID = "lemiex-ai";
const CAPABILITY_ID = "lemiex.operations.ask";

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lemiex: LemiexAgentService,
    private readonly operations: AiOperationsControlService,
    private readonly attachments: ChatAttachmentService
  ) {}

  async listConversations(userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { userId, agentId: AGENT_ID },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } }
      }
    });
  }

  async createConversation(userId: string, title?: unknown) {
    const normalizedTitle = typeof title === "string" && title.trim()
      ? title.trim().slice(0, 100)
      : "Cuộc trò chuyện mới";
    return this.prisma.chatConversation.create({
      data: { userId, agentId: AGENT_ID, title: normalizedTitle }
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId, agentId: AGENT_ID },
      include: {
        messages: {
          orderBy: [{ createdAt: "asc" }, { role: "asc" }],
          include: { attachments: { orderBy: { createdAt: "asc" } } }
        }
      }
    });
    if (!conversation) throw new NotFoundException("Không tìm thấy cuộc trò chuyện");
    return {
      ...conversation,
      messages: conversation.messages.map((message) => ({
        ...message,
        attachments: message.attachments.map((attachment) => this.attachments.publicAttachment(attachment))
      }))
    };
  }

  async getConversationWithUsage(
    userId: string,
    conversationId: string,
    includeUsage: boolean
  ) {
    const conversation = await this.getConversation(userId, conversationId);
    if (!includeUsage) return conversation;
    const runIds = conversation.messages.flatMap((message) =>
      message.agentRunId ? [message.agentRunId] : []
    );
    const runs = runIds.length
      ? await this.prisma.agentRun.findMany({ where: { id: { in: runIds } } })
      : [];
    const usage = new Map(runs.map((run) => [run.id, this.runUsage(run)]));
    return {
      ...conversation,
      messages: conversation.messages.map((message) => ({
        ...message,
        usage: message.agentRunId ? usage.get(message.agentRunId) || null : null
      }))
    };
  }

  async renameConversation(userId: string, conversationId: string, title: unknown) {
    await this.getConversation(userId, conversationId);
    const normalized = typeof title === "string" ? title.trim() : "";
    if (!normalized || normalized.length > 100) {
      throw new BadRequestException("Tên cuộc trò chuyện phải có từ 1 đến 100 ký tự");
    }
    return this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { title: normalized }
    });
  }

  async deleteConversation(userId: string, conversationId: string) {
    await this.getConversation(userId, conversationId);
    await this.attachments.removeConversationObjects(userId, conversationId);
    await this.prisma.chatConversation.delete({ where: { id: conversationId } });
    return { success: true };
  }

  async answer(
    userId: string,
    conversationId: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
    includeUsage = false,
    allowFinancialData = false,
    allowInventoryData = false,
    allowSellerPricingData = false,
    allowOrderLookupData = false,
    onTextDelta?: (text: string) => void
  ) {
    const conversation = await this.getConversation(userId, conversationId);
    const question = typeof body.content === "string" ? body.content.trim() : "";
    if (!question || question.length > 2000) {
      throw new BadRequestException("Câu hỏi phải có từ 1 đến 2000 ký tự");
    }
    const reportDate = this.resolveReportDate(question, body.reportDate);
    const attachmentIds = Array.isArray(body.attachmentIds)
      ? body.attachmentIds.filter((id): id is string => typeof id === "string").slice(0, 5)
      : [];
    const images = await this.attachments.imageInputs(userId, conversationId, attachmentIds);
    const retryAssistantMessageId = typeof body.retryAssistantMessageId === "string"
      ? body.retryAssistantMessageId
      : null;
    const retryPair = retryAssistantMessageId
      ? this.retryPair(conversation.messages, retryAssistantMessageId, question)
      : null;
    if (retryAssistantMessageId && !retryPair) {
      throw new BadRequestException("Không tìm thấy câu trả lời phù hợp để chạy lại");
    }
    const retryMessageIds = retryPair
      ? [retryPair.userMessageId, retryPair.assistantMessageId]
      : this.retryMessageIds(conversation.messages, question);
    const priorMessages = conversation.messages
      .filter((message) => !retryMessageIds.includes(message.id))
      .filter((message) => message.status === ChatMessageStatus.COMPLETED)
      .slice(-6)
      .map((message) => ({
        role: message.role === ChatMessageRole.USER ? "user" as const : "assistant" as const,
        content: message.content
      }));

    const operation = await this.operations.start({
      userId,
      agentId: AGENT_ID,
      capabilityId: CAPABILITY_ID,
      conversationId,
      question
    });
    let userMessage;
    let assistantMessage;
    try {
      [userMessage, assistantMessage] = await this.prisma.$transaction(async (tx) => {
        if (retryPair) {
          await tx.chatQuestionEvaluation.deleteMany({
            where: {
              OR: [
                { userMessageId: retryPair.userMessageId },
                { assistantMessageId: retryPair.assistantMessageId }
              ]
            }
          });
          await tx.chatMessage.delete({ where: { id: retryPair.assistantMessageId } });
        } else if (retryMessageIds.length) {
          await tx.chatMessage.deleteMany({ where: { id: { in: retryMessageIds } } });
        }
        const createdUserMessage = retryPair
          ? await tx.chatMessage.findUniqueOrThrow({ where: { id: retryPair.userMessageId } })
          : await tx.chatMessage.create({
              data: {
                conversationId,
                role: ChatMessageRole.USER,
                status: ChatMessageStatus.COMPLETED,
                content: question,
                reportDate
              }
            });
        const createdAssistantMessage = await tx.chatMessage.create({
          data: {
            conversationId,
            role: ChatMessageRole.ASSISTANT,
            status: ChatMessageStatus.PENDING,
            content: "",
            reportDate
          }
        });
        if (attachmentIds.length) {
          const attached = await tx.chatAttachment.updateMany({
            where: { id: { in: attachmentIds }, userId, conversationId },
            data: { messageId: createdUserMessage.id }
          });
          if (attached.count !== attachmentIds.length) throw new BadRequestException("Có ảnh đính kèm không hợp lệ");
        }
        await tx.chatConversation.update({
          where: { id: conversationId },
          data: {
            title: conversation.messages.length === 0
              ? this.titleFromQuestion(question)
              : conversation.title,
            updatedAt: new Date()
          }
        });
        return [createdUserMessage, createdAssistantMessage] as const;
      });
      await this.operations.attachMessages(operation.auditId, userMessage.id, assistantMessage.id);
    } catch (error) {
      const operationalError = this.isPendingAnswerConflict(error)
        ? this.operations.concurrentRequestError()
        : error;
      await this.operations.fail(operation, operationalError);
      throw operationalError;
    }

    try {
      const timeoutSignal = AbortSignal.timeout(requiredNumber("AI_CHAT_TIMEOUT_MS", 45_000));
      const executionSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;
      const run = await this.lemiex.run(CAPABILITY_ID, {
        question,
        reportDate,
        history: priorMessages,
        allowFinancialData,
        allowInventoryData,
        allowSellerPricingData,
        allowOrderLookupData
      }, {
        signal: executionSignal,
        onTextDelta,
        actorUserId: userId,
        conversationId,
        operationAuditId: operation.auditId,
        images
      });
      const output = run.output as unknown as LemiexQuestionAnswer;
      if (!output?.markdown) throw new Error("Lemiex AI không trả về câu trả lời hợp lệ");
      await this.operations.complete(operation, run);
      const completed = await this.prisma.chatMessage.update({
        where: { id: assistantMessage.id },
        data: {
          status: ChatMessageStatus.COMPLETED,
          content: output.markdown,
          sources: output.sources as unknown as Prisma.InputJsonValue,
          suggestions: output.suggestedQuestions as unknown as Prisma.InputJsonValue,
          agentRunId: run.id
        }
      });
      await this.prisma.chatQuestionEvaluation.create({
        data: {
          userId,
          conversationId,
          userMessageId: userMessage.id,
          assistantMessageId: completed.id,
          agentRunId: run.id,
          agentId: AGENT_ID,
          question,
          answer: output.markdown,
          classification: output.answerability.status as ChatAnswerability,
          reasonCode: output.answerability.reasonCode,
          reason: output.answerability.reason
        }
      });
      return {
        userMessage,
        assistantMessage: {
          ...completed,
          usage: includeUsage ? this.runUsage(run) : null
        },
        output,
        runId: run.id
      };
    } catch (error) {
      const controlledError = this.controlledExecutionError(error, signal);
      const canceled = this.isAbortError(controlledError);
      await this.prisma.chatMessage.update({
        where: { id: assistantMessage.id },
        data: {
          status: canceled ? ChatMessageStatus.CANCELED : ChatMessageStatus.FAILED,
          error: controlledError instanceof Error
            ? controlledError.message.slice(0, 1000)
            : "Không thể trả lời",
          content: canceled
            ? "Đã dừng tạo câu trả lời."
            : "Không thể hoàn tất câu trả lời. Vui lòng thử lại."
        }
      });
      await this.operations.fail(operation, controlledError);
      throw controlledError;
    }
  }

  private resolveReportDate(question: string, requested: unknown): string {
    const iso = question.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    const vietnamese = question.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    let reportDate = iso;
    if (!reportDate && vietnamese) {
      reportDate = `${vietnamese[3]}-${vietnamese[2].padStart(2, "0")}-${vietnamese[1].padStart(2, "0")}`;
    }
    if (!reportDate && /hôm qua/i.test(question)) {
      reportDate = shiftReportDate(this.todayInReportingTimezone(), -1);
    }
    if (!reportDate && typeof requested === "string" && requested) reportDate = requested;
    if (!reportDate) reportDate = this.todayInReportingTimezone();
    try {
      reportWindow(reportDate);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Ngày dữ liệu không hợp lệ");
    }
    return reportDate;
  }

  private todayInReportingTimezone(): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  private titleFromQuestion(question: string): string {
    return question.replace(/\s+/g, " ").slice(0, 72);
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error
      && (error.name === "AbortError" || /abort|cancel/i.test(error.message));
  }

  private controlledExecutionError(error: unknown, callerSignal?: AbortSignal): unknown {
    if (!callerSignal?.aborted && (this.isAbortError(error) || this.isTimeoutError(error))) {
      return new RequestTimeoutException(
        "Lemiex AI phản hồi quá thời gian cho phép. Vui lòng thử lại."
      );
    }
    return error;
  }

  private isTimeoutError(error: unknown): boolean {
    return error instanceof Error
      && (/timeout|timed out/i.test(error.message) || /timeout/i.test(error.name));
  }

  private isPendingAnswerConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002";
  }

  private retryMessageIds(
    messages: Array<{
      id: string;
      role: ChatMessageRole;
      status: ChatMessageStatus;
      content: string;
    }>,
    question: string
  ): string[] {
    const assistant = messages.at(-1);
    const user = messages.at(-2);
    if (
      assistant?.role === ChatMessageRole.ASSISTANT
      && (assistant.status === ChatMessageStatus.FAILED
        || assistant.status === ChatMessageStatus.CANCELED)
      && user?.role === ChatMessageRole.USER
      && user.content.trim() === question
    ) {
      return [user.id, assistant.id];
    }
    return [];
  }

  private retryPair(
    messages: Array<{
      id: string;
      role: ChatMessageRole;
      status: ChatMessageStatus;
      content: string;
    }>,
    assistantMessageId: string,
    question: string
  ): { userMessageId: string; assistantMessageId: string } | null {
    const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
    const assistant = messages[assistantIndex];
    if (
      assistantIndex < 1
      || assistant?.role !== ChatMessageRole.ASSISTANT
      || assistant.status === ChatMessageStatus.PENDING
    ) return null;
    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      const user = messages[index];
      if (user.role !== ChatMessageRole.USER) continue;
      if (user.content.trim() !== question.trim()) return null;
      return { userMessageId: user.id, assistantMessageId: assistant.id };
    }
    return null;
  }

  private runUsage(run: {
    model: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    estimatedCostUsd: Prisma.Decimal | null;
    startedAt: Date;
    completedAt: Date | null;
  }) {
    return {
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      estimatedCostUsd: run.estimatedCostUsd === null
        ? null
        : Number(run.estimatedCostUsd),
      responseTimeMs: run.completedAt
        ? run.completedAt.getTime() - run.startedAt.getTime()
        : null
    };
  }
}
