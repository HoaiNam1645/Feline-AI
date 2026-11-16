import { Controller, Get, Query, Req } from "@nestjs/common";
import { RequireAgentAccess } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { TiktokDashboardService } from "./tiktok-dashboard.service";

@Controller("tiktok/dashboard")
export class TiktokDashboardController {
  constructor(private readonly dashboard: TiktokDashboardService) {}

  @RequireAgentAccess({ agentId: "tiktok-ai", action: "view", capabilityId: "tiktok.data.ask" })
  @Get()
  get(@Req() request: AuthenticatedRequest, @Query("startDate") startDate: string, @Query("endDate") endDate: string) {
    return this.dashboard.get({ role: request.auth!.user.role, access: request.auth!.access }, startDate, endDate);
  }
}
