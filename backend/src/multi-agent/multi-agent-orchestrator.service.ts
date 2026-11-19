import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AgentRunStatus, ChatMessageRole, ChatMessageStatus, Prisma, UserRole } from "@prisma/client";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { findAgentDefinition } from "../agents/agent-definition";
import { LemiexAgentService } from "../agents/lemiex-agent.service";
import { hasAgentAccess } from "../auth/access-control";
import { CeoHrAnswerService } from "../ceo-chat/ceo-hr-answer.service";
import { PrismaService } from "../database/prisma.service";
import { EtsyKnowledgeAnswerService } from "../etsy-chat/etsy-knowledge-answer.service";
import { EtsyDataAnswerService } from "../etsy-data/etsy-data-answer.service";
import { AiOperationsControlService } from "../operations/ai-operations-control.service";
import { TiktokKnowledgeAnswerService } from "../tiktok-chat/tiktok-knowledge-answer.service";
import { TiktokDataAnswerService } from "../tiktok-data/tiktok-data-answer.service";
import { MultiAgentRouterService } from "./multi-agent-router.service";
import { MultiAgentActor, MultiAgentEvent, MultiAgentId, MultiAgentParticipantResult, MultiAgentSource } from "./multi-agent.types";

const CONVERSATION_AGENT_ID = "multi-agent";
const COORDINATOR_AGENT_ID = "ceo-ai";
const COORDINATOR_CAPABILITY_ID = "ceo.multi-agent.coordinate";

interface AgentAnswer {
  markdown: string;
  sources?: MultiAgentSource[];
  suggestedQuestions?: string[];
  usage?: { model: string | null; inputTokens: number; outputTokens: number; estimatedCostUsd: number | null };
}

interface SynthesisAnswer {
  markdown: string;
  suggestedQuestions: string[];
}

@Injectable()
export class MultiAgentOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAgentRouterService,
    private readonly provider: AnthropicStructuredProvider,
    private readonly operations: AiOperationsControlService,
    private readonly ceoAnswers: CeoHrAnswerService,
    private readonly tiktokKnowledge: TiktokKnowledgeAnswerService,
    private readonly tiktokData: TiktokDataAnswerService,
    private readonly etsyKnowledge: EtsyKnowledgeAnswerService,
    private readonly etsyData: EtsyDataAnswerService,
    private readonly lemiex: LemiexAgentService
  ) {}

  listConversations(userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { userId, agentId: CONVERSATION_AGENT_ID },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { messages: true } } }
    });
  }

  createConversation(userId: string, title?: unknown) {
    const normalized = typeof title === "string" && title.trim() ? title.trim().slice(0, 100) : "Cuộc họp AI mới";
    return this.prisma.chatConversation.create({ data: { userId, agentId: CONVERSATION_AGENT_ID, title: normalized } });
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId, agentId: CONVERSATION_AGENT_ID },
      include: { messages: { orderBy: [{ createdAt: "asc" }, { role: "asc" }] } }
    });
    if (!conversation) throw new NotFoundException("Không tìm thấy cuộc họp AI");
    return conversation;
  }

  async answer(
    actor: MultiAgentActor,
    conversationId: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
    onEvent?: (event: MultiAgentEvent) => void
  ) {
    const conversation = await this.getConversation(actor.id, conversationId);
    const question = typeof body.content === "string" ? body.content.trim() : "";
    if (!question || question.length > 3000) throw new BadRequestException("Nhiệm vụ phải có từ 1 đến 3000 ký tự");
    if (!hasAgentAccess(actor.access, { agentId: COORDINATOR_AGENT_ID, action: "run" })) {
      throw new ForbiddenException("Bạn không có quyền giao nhiệm vụ cho CEO AI");
    }

    const routed = this.router.route(question, body.participantAgentIds);
    const participants = routed.filter((agentId) => this.canRunAgent(actor, agentId, question));
    if (!participants.length) throw new ForbiddenException("Không có Agent phù hợp trong phạm vi quyền hiện tại");

    const operation = await this.operations.start({
      userId: actor.id,
      agentId: COORDINATOR_AGENT_ID,
      capabilityId: COORDINATOR_CAPABILITY_ID,
      conversationId,
      question
    });
    let assistantMessageId: string | null = null;
    let coordinatorRunId: string | null = null;
    try {
      const [userMessage, assistantMessage] = await this.prisma.$transaction(async (tx) => {
        const user = await tx.chatMessage.create({ data: { conversationId, role: ChatMessageRole.USER, status: ChatMessageStatus.COMPLETED, content: question } });
        const assistant = await tx.chatMessage.create({ data: { conversationId, role: ChatMessageRole.ASSISTANT, status: ChatMessageStatus.PENDING, content: "" } });
        await tx.chatConversation.update({
          where: { id: conversationId },
          data: { title: conversation.messages.length ? conversation.title : question.replace(/\s+/g, " ").slice(0, 72), updatedAt: new Date() }
        });
        return [user, assistant] as const;
      });
      assistantMessageId = assistantMessage.id;
      await this.operations.attachMessages(operation.auditId, userMessage.id, assistantMessage.id);
      const coordinatorRun = await this.prisma.agentRun.create({
        data: {
          agentId: COORDINATOR_AGENT_ID,
          capabilityId: COORDINATOR_CAPABILITY_ID,
          status: AgentRunStatus.RUNNING,
          input: { question, participants } as Prisma.InputJsonValue,
          actorUserId: actor.id,
          conversationId,
          operationAuditId: operation.auditId
        }
      });
      coordinatorRunId = coordinatorRun.id;
      onEvent?.({ type: "meeting_started", meetingId: coordinatorRun.id, participants });

      const results: MultiAgentParticipantResult[] = [];
      for (const agentId of participants) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const agentName = findAgentDefinition(agentId)?.name || agentId;
        onEvent?.({ type: "agent_started", agentId, agentName });
        try {
          const result = await this.runParticipant(actor, agentId, question, conversationId, signal);
          results.push(result);
          onEvent?.({ type: "agent_completed", result });
        } catch (error) {
          const result: MultiAgentParticipantResult = {
            agentId,
            agentName,
            capabilityId: this.capabilityFor(agentId, question),
            status: "FAILED",
            markdown: "",
            sources: [],
            runId: null,
            error: error instanceof Error ? error.message.slice(0, 500) : "Agent không thể hoàn tất nhiệm vụ",
            usage: null
          };
          results.push(result);
          onEvent?.({ type: "agent_failed", result });
        }
      }

      const completed = results.filter((result) => result.status === "COMPLETED");
      if (!completed.length) throw new Error("Không Agent nào hoàn tất được phần việc được giao");
      onEvent?.({ type: "synthesis_started", message: completed.length > 1 ? "CEO AI đang tổng hợp ý kiến các Agent" : "CEO AI đang hoàn thiện kết quả" });
      const synthesis = await this.synthesize(question, completed, signal, (text) => onEvent?.({ type: "delta", text }));
      const sources = completed.flatMap((result) => result.sources.map((source) => ({ ...source, agentId: result.agentId, agentName: result.agentName })));
      const totalUsage = completed.reduce((total, result) => ({
        inputTokens: total.inputTokens + (result.usage?.inputTokens || 0),
        outputTokens: total.outputTokens + (result.usage?.outputTokens || 0),
        estimatedCostUsd: total.estimatedCostUsd + (result.usage?.estimatedCostUsd || 0)
      }), { inputTokens: synthesis.usage.inputTokens, outputTokens: synthesis.usage.outputTokens, estimatedCostUsd: synthesis.usage.estimatedCostUsd || 0 });
      const completedRun = await this.prisma.agentRun.update({
        where: { id: coordinatorRun.id },
        data: {
          status: AgentRunStatus.COMPLETED,
          output: { markdown: synthesis.markdown, participants: results, suggestedQuestions: synthesis.suggestedQuestions } as unknown as Prisma.InputJsonValue,
          model: synthesis.usage.model,
          promptVersion: "ceo-multi-agent-coordinate-v1",
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          estimatedCostUsd: new Prisma.Decimal(totalUsage.estimatedCostUsd),
          completedAt: new Date()
        }
      });
      await this.operations.complete(operation, completedRun);
      const completedMessage = await this.prisma.chatMessage.update({
        where: { id: assistantMessage.id },
        data: {
          status: ChatMessageStatus.COMPLETED,
          content: synthesis.markdown,
          sources: sources as unknown as Prisma.InputJsonValue,
          suggestions: synthesis.suggestedQuestions as unknown as Prisma.InputJsonValue,
          agentRunId: coordinatorRun.id
        }
      });
      onEvent?.({ type: "complete", assistantMessage: completedMessage, participants: results, runId: coordinatorRun.id });
      return { userMessage, assistantMessage: completedMessage, participants: results, runId: coordinatorRun.id };
    } catch (error) {
      if (assistantMessageId) {
        await this.prisma.chatMessage.update({
          where: { id: assistantMessageId },
          data: { status: ChatMessageStatus.FAILED, content: "Không thể hoàn tất cuộc họp AI. Vui lòng thử lại.", error: error instanceof Error ? error.message.slice(0, 1000) : "Multi-agent meeting failed" }
        });
      }
      if (coordinatorRunId) {
        await this.prisma.agentRun.updateMany({
          where: { id: coordinatorRunId, status: AgentRunStatus.RUNNING },
          data: { status: AgentRunStatus.FAILED, error: error instanceof Error ? error.message.slice(0, 1000) : "Multi-agent meeting failed", completedAt: new Date() }
        });
      }
      await this.operations.fail(operation, error);
      throw error;
    }
  }

  private async runParticipant(actor: MultiAgentActor, agentId: MultiAgentId, question: string, conversationId: string, signal?: AbortSignal): Promise<MultiAgentParticipantResult> {
    if (agentId === "lemiex-ai") {
      const managementAccess = actor.role === UserRole.ADMIN || actor.role === UserRole.MANAGER;
      const run = await this.lemiex.run("lemiex.operations.ask", {
        question: this.agentQuestion(agentId, question),
        reportDate: this.todayInVietnam(),
        history: [],
        allowFinancialData: managementAccess,
        allowInventoryData: managementAccess,
        allowSellerPricingData: managementAccess,
        allowOrderLookupData: managementAccess
      }, { signal, actorUserId: actor.id, conversationId });
      const output = run.output as unknown as AgentAnswer;
      return this.result(agentId, "lemiex.operations.ask", output, run.id);
    }

    const capabilityId = this.capabilityFor(agentId, question);
    const run = await this.prisma.agentRun.create({
      data: { agentId, capabilityId, status: AgentRunStatus.RUNNING, input: { question, multiAgent: true } as Prisma.InputJsonValue, actorUserId: actor.id, conversationId }
    });
    try {
      const answer = await this.answerWithAgent(actor, agentId, question, run.id, signal);
      const completed = await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.COMPLETED,
          output: answer as unknown as Prisma.InputJsonValue,
          model: answer.usage?.model || null,
          promptVersion: `${capabilityId}-multi-agent-v1`,
          inputTokens: answer.usage?.inputTokens || 0,
          outputTokens: answer.usage?.outputTokens || 0,
          estimatedCostUsd: answer.usage?.estimatedCostUsd == null ? null : new Prisma.Decimal(answer.usage.estimatedCostUsd),
          completedAt: new Date()
        }
      });
      return this.result(agentId, capabilityId, answer, completed.id);
    } catch (error) {
      await this.prisma.agentRun.update({ where: { id: run.id }, data: { status: AgentRunStatus.FAILED, error: error instanceof Error ? error.message.slice(0, 1000) : "Agent failed", completedAt: new Date() } });
      throw error;
    }
  }

  private async answerWithAgent(actor: MultiAgentActor, agentId: Exclude<MultiAgentId, "lemiex-ai">, question: string, runId: string, signal?: AbortSignal): Promise<AgentAnswer> {
    const tailored = this.agentQuestion(agentId, question);
    if (agentId === "ceo-ai") return this.ceoAnswers.answer(actor, tailored, [], signal) as Promise<AgentAnswer>;
    if (agentId === "tiktok-ai") {
      const route = this.tiktokData.route(tailored);
      return route.kind === "data"
        ? this.tiktokData.answer(actor, tailored, route, runId, signal) as Promise<AgentAnswer>
        : this.tiktokKnowledge.answer(actor, tailored, [], signal) as Promise<AgentAnswer>;
    }
    const route = this.etsyData.route(tailored);
    return route.kind === "data"
      ? this.etsyData.answer(actor, tailored, route, runId, signal) as Promise<AgentAnswer>
      : this.etsyKnowledge.answer(actor, tailored, [], signal) as Promise<AgentAnswer>;
  }

  private async synthesize(question: string, results: MultiAgentParticipantResult[], signal?: AbortSignal, onTextDelta?: (text: string) => void) {
    if (results.length === 1) {
      onTextDelta?.(results[0].markdown);
      return { markdown: results[0].markdown, suggestedQuestions: [], usage: { model: null, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null } };
    }
    const generation = await this.provider.generateObject<SynthesisAnswer>({
      system: [
        "Bạn là CEO AI của Feline, chủ trì cuộc họp giữa các AI chuyên môn.",
        "Chỉ tổng hợp từ báo cáo Agent được cung cấp; không tự thêm số liệu, nguyên nhân hoặc cam kết.",
        "Nếu các Agent thiếu dữ liệu hoặc mâu thuẫn, phải nêu rõ thay vì tự hòa giải bằng giả định.",
        "Tôn trọng phạm vi dữ liệu của từng Agent và giữ nguyên mốc thời gian, đơn vị, nguồn.",
        "Kết quả cần gồm: Kết luận điều hành, Ý kiến từng Agent, Kế hoạch đề xuất, Chỉ số theo dõi và Rủi ro cần xác minh.",
        "Không tự phê duyệt hoặc thực thi hành động. Trả lời tiếng Việt bằng Markdown."
      ].join("\n"),
      user: `Nhiệm vụ: ${question}\n\nBáo cáo từ các Agent:\n${JSON.stringify(results.map((result) => ({ agentId: result.agentId, agentName: result.agentName, markdown: result.markdown, sources: result.sources })))}`,
      toolName: "submit_multi_agent_synthesis",
      toolDescription: "Trả về biên bản và kế hoạch tổng hợp từ nhiều Agent.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["markdown", "suggestedQuestions"],
        properties: {
          markdown: { type: "string" },
          suggestedQuestions: { type: "array", items: { type: "string", maxLength: 180 }, maxItems: 3 }
        }
      },
      maxOutputTokens: 1800,
      signal,
      onTextDelta
    });
    return { markdown: generation.value.markdown.trim(), suggestedQuestions: generation.value.suggestedQuestions || [], usage: { model: generation.model, inputTokens: generation.inputTokens, outputTokens: generation.outputTokens, estimatedCostUsd: generation.estimatedCostUsd } };
  }

  private canRunAgent(actor: MultiAgentActor, agentId: MultiAgentId, question: string): boolean {
    const capabilityId = this.capabilityFor(agentId, question);
    const dataScopeIds = agentId === "ceo-ai" ? ["ceo.hr.knowledge"] : agentId === "lemiex-ai" ? ["lemiex.operations.basic"] : [];
    return hasAgentAccess(actor.access, { agentId, action: "run", capabilityId, dataScopeIds });
  }

  private capabilityFor(agentId: MultiAgentId, question: string): string {
    if (agentId === "ceo-ai") return "ceo.hr.ask";
    if (agentId === "lemiex-ai") return "lemiex.operations.ask";
    if (agentId === "tiktok-ai") return this.tiktokData.route(this.agentQuestion(agentId, question)).kind === "data" ? "tiktok.data.ask" : "tiktok.knowledge.ask";
    return this.etsyData.route(this.agentQuestion(agentId, question)).kind === "data" ? "etsy.data.ask" : "etsy.knowledge.ask";
  }

  private agentQuestion(agentId: MultiAgentId, question: string): string {
    if (agentId === "tiktok-ai") return `${question}\n\nHãy phân tích riêng phạm vi TikTok, ưu tiên số đơn, doanh thu, team, store và các điểm nghẽn có dữ liệu.`;
    if (agentId === "etsy-ai") return `${question}\n\nHãy phân tích riêng phạm vi Etsy, ưu tiên số đơn, doanh thu, shop, seller và các điểm nghẽn có dữ liệu.`;
    if (agentId === "lemiex-ai") return `${question}\n\nHãy phân tích riêng năng lực fulfillment của xưởng Lemiex, backlog, shipout và rủi ro vận hành liên quan.`;
    return `${question}\n\nHãy kiểm tra phần chính sách, nhân sự và nguyên tắc điều hành nội bộ có liên quan.`;
  }

  private result(agentId: MultiAgentId, capabilityId: string, answer: AgentAnswer, runId: string): MultiAgentParticipantResult {
    return {
      agentId,
      agentName: findAgentDefinition(agentId)?.name || agentId,
      capabilityId,
      status: "COMPLETED",
      markdown: answer.markdown,
      sources: Array.isArray(answer.sources) ? answer.sources : [],
      runId,
      error: null,
      usage: answer.usage || null
    };
  }

  private todayInVietnam(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
}
