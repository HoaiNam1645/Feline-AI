import { BadRequestException, Controller, Get, Param, Req } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RequireAgentAccess, RequireRoles } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { SourceMysqlService } from "../source/source-mysql.service";
import { WorkshopMetricsService } from "./workshop-metrics.service";

@Controller("metrics")
export class WorkshopMetricsController {
  constructor(
    private readonly metrics: WorkshopMetricsService,
    private readonly source: SourceMysqlService
  ) {}

  @RequireRoles(UserRole.ADMIN)
  @Get("source/health")
  async sourceHealth() {
    return {
      status: "ok",
      source: await this.source.connectionInfo()
    };
  }

  @RequireAgentAccess({
    agentId: "lemiex-ai",
    action: "view",
    dataScopeIds: ["lemiex.operations.basic"]
  })
  @Get("workshop/daily/:date")
  async daily(@Param("date") date: string, @Req() request: AuthenticatedRequest) {
    try {
      const managementAccess = request.auth!.user.role === UserRole.ADMIN
        || request.auth!.user.role === UserRole.MANAGER;
      const result = await this.metrics.calculateDaily(date, managementAccess);
      const { provisionalCosts: _internalFinancials, ...safeResult } = result;
      return safeResult;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("reportDate")) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
