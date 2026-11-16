import { ForbiddenException, Injectable } from "@nestjs/common";
import { AgentRunStatus, Prisma, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AccessProfile, hasAgentAccess } from "../../auth/access-control";
import { CeoHrAnswerService } from "../../ceo-chat/ceo-hr-answer.service";
import { PrismaService } from "../../database/prisma.service";
import { AiOperationsControlService } from "../../operations/ai-operations-control.service";
import { TiktokKnowledgeAnswerService } from "../../tiktok-chat/tiktok-knowledge-answer.service";

interface DelegationActor {
  id: string;
  role: UserRole;
  departmentCode: string | null;
  access: AccessProfile;
}

const ROUTES = {
  "ceo-ai:tiktok-ai": {
    sourceCapabilityId: "ceo.hr.ask",
    sourceScopeId: "ceo.hr.knowledge",
    targetCapabilityId: "tiktok.knowledge.ask",
    targetScopeId: "tiktok.knowledge"
  },
  "tiktok-ai:ceo-ai": {
    sourceCapabilityId: "tiktok.knowledge.ask",
    sourceScopeId: "tiktok.knowledge",
    targetCapabilityId: "ceo.hr.ask",
    targetScopeId: "ceo.hr.knowledge"
  }
} as const;

@Injectable()
export class KnowledgeDelegationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: AiOperationsControlService,
    private readonly ceoAnswers: CeoHrAnswerService,
    private readonly tiktokAnswers: TiktokKnowledgeAnswerService
  ) {}

  async delegate(
    actor: DelegationActor,
    sourceAgentId: string,
    targetAgentId: string,
    question: string,
    onTextDelta?: (text: string) => void
  ) {
    const route = ROUTES[`${sourceAgentId}:${targetAgentId}` as keyof typeof ROUTES];
    if (!route || !question.trim() || question.trim().length > 2000) {
      throw new ForbiddenException("Yêu cầu chuyển tiếp không hợp lệ");
    }
    const sourceAllowed = hasAgentAccess(actor.access, {
      agentId: sourceAgentId,
      action: "run",
      capabilityId: route.sourceCapabilityId,
      dataScopeIds: [route.sourceScopeId]
    });
    const targetAllowed = hasAgentAccess(actor.access, {
      agentId: targetAgentId,
      action: "run",
      capabilityId: route.targetCapabilityId,
      dataScopeIds: [route.targetScopeId]
    });
    if (!sourceAllowed || !targetAllowed) {
      throw new ForbiddenException("Bạn không có đủ quyền để chuyển câu hỏi giữa hai Agent");
    }

    const delegationId = randomUUID();
    const operation = await this.operations.start({
      userId: actor.id,
      agentId: targetAgentId,
      capabilityId: route.targetCapabilityId,
      conversationId: delegationId,
      question: question.trim()
    });
    await this.prisma.aiOperationAudit.update({
      where: { id: operation.auditId },
      data: { metadata: { delegationId, sourceAgentId, targetAgentId } }
    });
    const run = await this.prisma.agentRun.create({
      data: {
        agentId: targetAgentId,
        capabilityId: route.targetCapabilityId,
        status: AgentRunStatus.RUNNING,
        input: { delegationId, sourceAgentId, targetAgentId, question: question.trim() },
        actorUserId: actor.id,
        operationAuditId: operation.auditId
      }
    });
    try {
      const knowledgeActor = { id: actor.id, role: actor.role, departmentCode: actor.departmentCode };
      const answer = targetAgentId === "tiktok-ai"
        ? await this.tiktokAnswers.answer(knowledgeActor, question.trim(), [], undefined, onTextDelta)
        : await this.ceoAnswers.answer(knowledgeActor, question.trim(), [], undefined, onTextDelta);
      const completedRun = await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.COMPLETED,
          output: answer as unknown as Prisma.InputJsonValue,
          model: answer.usage.model,
          promptVersion: targetAgentId === "tiktok-ai" ? "tiktok-knowledge-qa-v1" : "ceo-hr-qa-v2",
          inputTokens: answer.usage.inputTokens,
          outputTokens: answer.usage.outputTokens,
          estimatedCostUsd: answer.usage.estimatedCostUsd === null ? null : new Prisma.Decimal(answer.usage.estimatedCostUsd),
          completedAt: new Date()
        }
      });
      await this.operations.complete(operation, completedRun);
      return {
        delegationId,
        runId: run.id,
        sourceAgentId,
        targetAgentId,
        answerMarkdown: answer.markdown,
        sources: answer.sources,
        suggestions: answer.suggestedQuestions,
        answerability: answer.answerability
        ,usage: answer.usage
      };
    } catch (error) {
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: { status: AgentRunStatus.FAILED, error: error instanceof Error ? error.message.slice(0, 1000) : "Delegation failed", completedAt: new Date() }
      });
      await this.operations.fail(operation, error);
      throw error;
    }
  }
}
