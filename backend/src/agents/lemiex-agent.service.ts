import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { AgentRunStatus, Prisma } from "@prisma/client";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { PrismaService } from "../database/prisma.service";
import { LEMIEX_AGENT_DEFINITION } from "./agent-definition";
import {
  AgentCapability,
  AgentExecutionContext,
  LEMIEX_CAPABILITIES
} from "./capabilities/agent-capability";

@Injectable()
export class LemiexAgentService {
  private readonly capabilities: Map<string, AgentCapability>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AnthropicStructuredProvider,
    @Inject(LEMIEX_CAPABILITIES) capabilities: AgentCapability[]
  ) {
    this.capabilities = new Map(
      capabilities.map((capability) => [capability.id, capability])
    );
  }

  definition() {
    return {
      ...LEMIEX_AGENT_DEFINITION,
      provider: this.provider.configuration()
    };
  }

  isEnabled(): boolean {
    return this.provider.isConfigured();
  }

  async run(
    capabilityId: string,
    rawInput: unknown,
    context?: AgentExecutionContext
  ) {
    const definition = LEMIEX_AGENT_DEFINITION.capabilities.find(
      (capability) => capability.id === capabilityId
    );
    if (!definition) {
      throw new NotFoundException(`Unknown Lemiex AI capability: ${capabilityId}`);
    }
    if (definition.status !== "available") {
      throw new ServiceUnavailableException(
        `Lemiex AI capability is planned but not available: ${capabilityId}`
      );
    }
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException(
        "Lemiex AI is installed but disabled until Anthropic configuration is provided"
      );
    }

    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      throw new ServiceUnavailableException(
        `Lemiex AI capability is declared but not registered: ${capabilityId}`
      );
    }
    const input = capability.validateInput(rawInput);
    const providerConfiguration = this.provider.configuration();

    const run = await this.prisma.agentRun.create({
      data: {
        agentId: LEMIEX_AGENT_DEFINITION.id,
        capabilityId,
        input: input as unknown as Prisma.InputJsonValue,
        promptVersion: capability.promptVersion,
        model: typeof providerConfiguration.model === "string"
          ? providerConfiguration.model
          : undefined,
        actorUserId: context?.actorUserId,
        conversationId: context?.conversationId,
        operationAuditId: context?.operationAuditId
      }
    });

    try {
      const result = await capability.execute(run.id, input, context);
      return await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.COMPLETED,
          output: result.output as Prisma.InputJsonValue,
          model: result.generation?.model,
          inputTokens: result.generation?.inputTokens,
          outputTokens: result.generation?.outputTokens,
          estimatedCostUsd: result.generation?.estimatedCostUsd,
          metricSnapshotId: result.metricSnapshotId,
          completedAt: new Date()
        },
        include: { toolCalls: true }
      });
    } catch (error) {
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: this.isAbortError(error) ? AgentRunStatus.BLOCKED : AgentRunStatus.FAILED,
          error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown agent error",
          completedAt: new Date()
        }
      });
      throw error;
    }
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error
      && (error.name === "AbortError" || /abort|cancel/i.test(error.message));
  }
}
