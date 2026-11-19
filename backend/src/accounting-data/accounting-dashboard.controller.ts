import { Controller, ForbiddenException, Get, Query, Req } from "@nestjs/common";
import { RequireAgentAccess } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { AccountingSourceService } from "./accounting-source.service";

@Controller("accounting/dashboard")
export class AccountingDashboardController {
  constructor(private readonly source: AccountingSourceService) {}

  @RequireAgentAccess({ agentId: "accounting-ai", action: "view", capabilityId: "accounting.data.ask" })
  @Get()
  get(@Req() request: AuthenticatedRequest, @Query("startDate") startDate: string, @Query("endDate") endDate: string) {
    const access = request.auth!.access;
    const allowed = access.platformAdmin || access.grants.some((grant) => (
      grant.agentId === "accounting-ai"
      && ((grant.actions as string[]).includes("*") || grant.actions.includes("view"))
      && (grant.capabilityIds.includes("*") || grant.capabilityIds.includes("accounting.data.ask"))
      && (grant.dataScopeIds.includes("*") || grant.dataScopeIds.includes("accounting.data.all") || grant.dataScopeIds.includes("accounting.data.overview"))
    ));
    if (!allowed) throw new ForbiddenException("Bạn không có quyền xem tổng quan tài chính");
    return this.source.get("overview", startDate, endDate);
  }
}
