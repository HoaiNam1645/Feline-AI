import { Controller, Get, Query, Req } from "@nestjs/common";
import { RequireAgentAccess } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { EtsyDashboardService } from "./etsy-dashboard.service";

@Controller("etsy/dashboard")
export class EtsyDashboardController {
  constructor(private readonly dashboard: EtsyDashboardService) {}

  @RequireAgentAccess({ agentId: "etsy-ai", action: "view", capabilityId: "etsy.data.ask" })
  @Get()
  get(
    @Req() request: AuthenticatedRequest,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("sellerTeamId") sellerTeamId = "all",
    @Query("shopId") shopId = "all",
    @Query("sellerId") sellerId = "all"
  ) {
    const ids = (value: string) => value && value !== "all" ? [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))] : [];
    return this.dashboard.get(
      { role: request.auth!.user.role, access: request.auth!.access },
      startDate,
      endDate,
      { sellerTeamIds: ids(sellerTeamId), shopIds: ids(shopId), sellerIds: ids(sellerId) }
    );
  }
}
