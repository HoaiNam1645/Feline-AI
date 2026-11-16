import { Injectable } from "@nestjs/common";
import { AgentToolCallStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { TiktokToolInput, TiktokToolOutput } from "./tiktok-data.types";
import {
  AnyTiktokTool, TiktokDesignTool, TiktokFinanceTool, TiktokFulfillmentTool,
  TiktokOrdersTool, TiktokOverviewTool, TiktokStoresTool, TiktokTeamTool
} from "./tiktok-tools";

@Injectable()
export class TiktokToolExecutorService {
  private readonly tools: Map<string, AnyTiktokTool>;

  constructor(
    private readonly prisma: PrismaService,
    overview: TiktokOverviewTool,
    orders: TiktokOrdersTool,
    finance: TiktokFinanceTool,
    team: TiktokTeamTool,
    stores: TiktokStoresTool,
    fulfillment: TiktokFulfillmentTool,
    design: TiktokDesignTool
  ) {
    this.tools = new Map([overview, orders, finance, team, stores, fulfillment, design].map((tool) => [tool.id, tool]));
  }

  async execute(agentRunId: string, toolId: string, input: TiktokToolInput): Promise<TiktokToolOutput> {
    const tool = this.tools.get(toolId);
    if (!tool) throw new Error(`TikTok tool is not registered: ${toolId}`);
    const call = await this.prisma.agentToolCall.create({
      data: { agentRunId, toolId, input: input as unknown as Prisma.InputJsonValue }
    });
    try {
      const output = await tool.execute(input);
      await this.prisma.agentToolCall.update({
        where: { id: call.id },
        data: { status: AgentToolCallStatus.COMPLETED, output: output as unknown as Prisma.InputJsonValue, completedAt: new Date() }
      });
      return output;
    } catch (error) {
      await this.prisma.agentToolCall.update({
        where: { id: call.id },
        data: { status: AgentToolCallStatus.FAILED, error: error instanceof Error ? error.message.slice(0,1000) : "Unknown TikTok tool error", completedAt: new Date() }
      });
      throw error;
    }
  }
}
