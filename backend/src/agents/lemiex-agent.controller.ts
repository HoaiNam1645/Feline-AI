import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RequireAgentAccess } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { PrismaService } from "../database/prisma.service";
import { DailyAnalysisPreparationService } from "../report-engine/daily-analysis-preparation.service";
import { LEMIEX_AGENT_DEFINITION } from "./agent-definition";
import { LemiexAgentService } from "./lemiex-agent.service";
import { AgentToolExecutorService } from "./tools/agent-tool-executor.service";

@Controller("agents/lemiex")
export class LemiexAgentController {
  constructor(
    private readonly agent: LemiexAgentService,
    private readonly tools: AgentToolExecutorService,
    private readonly prisma: PrismaService,
    private readonly dailyAnalysis: DailyAnalysisPreparationService
  ) {}

  @RequireAgentAccess({ agentId: "lemiex-ai", action: "view" })
  @Get()
  definition() {
    return {
      ...this.agent.definition(),
      registeredTools: this.tools.listTools()
    };
  }

  @RequireAgentAccess({
    agentId: "lemiex-ai",
    action: "run",
    dataScopeIds: ["lemiex.operations.basic"],
    capabilityBodyField: "capabilityId"
  })
  @Post("runs")
  async run(@Body() body: Record<string, unknown>, @Req() request: AuthenticatedRequest) {
    const capabilityId = String(body.capabilityId ?? "");
    if (!capabilityId) throw new BadRequestException("capabilityId is required");
    const rawInput = body.input ?? Object.fromEntries(
      Object.entries(body).filter(([key]) => key !== "capabilityId")
    );
    const managementAccess = request.auth!.user.role === UserRole.ADMIN
      || request.auth!.user.role === UserRole.MANAGER;
    const input = capabilityId === "lemiex.operations.ask" && rawInput && typeof rawInput === "object"
      ? {
          ...(rawInput as Record<string, unknown>),
          allowFinancialData: managementAccess,
          allowInventoryData: managementAccess,
          allowSellerPricingData: managementAccess,
          allowOrderLookupData: managementAccess
        }
      : rawInput;
    try {
      if (capabilityId === "lemiex.operations.daily-review" && input && typeof input === "object") {
        const reportDate = (input as Record<string, unknown>).reportDate;
        if (typeof reportDate === "string") await this.dailyAnalysis.prepare(reportDate);
      }
      return await this.agent.run(capabilityId, input);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error && typeof error === "object" && "getStatus" in error) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid capability input"
      );
    }
  }

  @RequireAgentAccess({
    agentId: "lemiex-ai",
    action: "view_audit",
    dataScopeIds: ["lemiex.operations.audit"]
  })
  @Get("runs")
  async listRuns(@Query("limit") rawLimit?: string) {
    const parsedLimit = Number(rawLimit || 20);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100)
      : 20;
    return this.prisma.agentRun.findMany({
      where: { agentId: LEMIEX_AGENT_DEFINITION.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { toolCalls: true }
    });
  }

  @RequireAgentAccess({
    agentId: "lemiex-ai",
    action: "view_audit",
    dataScopeIds: ["lemiex.operations.audit"]
  })
  @Get("runs/:id")
  async getRun(@Param("id") id: string) {
    return this.prisma.agentRun.findFirstOrThrow({
      where: { id, agentId: LEMIEX_AGENT_DEFINITION.id },
      include: { toolCalls: true }
    });
  }
}
