import { Injectable } from "@nestjs/common";
import { AgentToolCallStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { LEMIEX_AGENT_DEFINITION } from "../agent-definition";
import { AgentTool } from "./agent-tool";
import { DailyReportTool } from "./daily-report.tool";
import { DailySnapshotTool } from "./daily-snapshot.tool";
import { LiveDailyMetricsTool } from "./live-daily-metrics.tool";
import { LivePeriodMetricsTool } from "./live-period-metrics.tool";
import { InventoryMetricsTool } from "./inventory-metrics.tool";
import { SellerPricingMetricsTool } from "./seller-pricing-metrics.tool";
import { OrderLookupTool } from "./order-lookup.tool";

@Injectable()
export class AgentToolExecutorService {
  private readonly tools: Map<string, AgentTool>;

  constructor(
    private readonly prisma: PrismaService,
    dailySnapshot: DailySnapshotTool,
    dailyReport: DailyReportTool,
    liveDailyMetrics: LiveDailyMetricsTool,
    inventoryMetrics: InventoryMetricsTool,
    livePeriodMetrics?: LivePeriodMetricsTool,
    sellerPricingMetrics?: SellerPricingMetricsTool,
    orderLookup?: OrderLookupTool
  ) {
    this.tools = new Map<string, AgentTool>([
      [dailySnapshot.id, dailySnapshot],
      [dailyReport.id, dailyReport],
      [liveDailyMetrics.id, liveDailyMetrics],
      [inventoryMetrics.id, inventoryMetrics],
      ...(livePeriodMetrics ? [[livePeriodMetrics.id, livePeriodMetrics] as [string, AgentTool]] : []),
      ...(sellerPricingMetrics ? [[sellerPricingMetrics.id, sellerPricingMetrics] as [string, AgentTool]] : []),
      ...(orderLookup ? [[orderLookup.id, orderLookup] as [string, AgentTool]] : [])
    ]);
  }

  listTools(): Array<{ id: string; description: string }> {
    return [...this.tools.values()].map((tool) => ({
      id: tool.id,
      description: tool.description
    }));
  }

  async execute<TInput, TOutput>(
    agentRunId: string,
    toolId: string,
    input: TInput
  ): Promise<TOutput> {
    const tool = this.tools.get(toolId);
    if (!tool) throw new Error(`Agent tool is not registered: ${toolId}`);

    const run = await this.prisma.agentRun.findUnique({
      where: { id: agentRunId },
      select: { capabilityId: true }
    });
    const capability = LEMIEX_AGENT_DEFINITION.capabilities.find(
      (item) => item.id === run?.capabilityId
    );
    if (!capability?.allowedTools.includes(toolId)) {
      throw new Error(
        `Tool ${toolId} is not allowed for capability ${run?.capabilityId ?? "unknown"}`
      );
    }

    const call = await this.prisma.agentToolCall.create({
      data: {
        agentRunId,
        toolId,
        input: input as Prisma.InputJsonValue
      }
    });
    try {
      const output = await tool.execute(input) as TOutput;
      await this.prisma.agentToolCall.update({
        where: { id: call.id },
        data: {
          status: AgentToolCallStatus.COMPLETED,
          output: output as Prisma.InputJsonValue,
          completedAt: new Date()
        }
      });
      return output;
    } catch (error) {
      await this.prisma.agentToolCall.update({
        where: { id: call.id },
        data: {
          status: AgentToolCallStatus.FAILED,
          error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown tool error",
          completedAt: new Date()
        }
      });
      throw error;
    }
  }
}
