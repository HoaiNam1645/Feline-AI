import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RequireRoles } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { DailyReportsService } from "./daily-reports.service";

@Controller("daily-reports")
@RequireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
export class DailyReportsController {
  constructor(private readonly reports: DailyReportsService) {}

  @Get("teams")
  teams(@Req() request: AuthenticatedRequest, @Query("date") date?: string) {
    return this.reports.teams(request.auth!, date);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query("teamId") teamId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.reports.list(request.auth!, { teamId, from, to });
  }

  @Get(":id")
  detail(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.reports.detail(request.auth!, id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.reports.create(request.auth!, body);
  }

  @Patch(":id")
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.reports.update(request.auth!, id, body);
  }

  @Post(":id/submit")
  submit(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.reports.submit(request.auth!, id);
  }

  @Post(":id/acknowledge")
  acknowledge(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.reports.acknowledge(request.auth!, id);
  }

  @Post(":id/comments")
  comment(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.reports.comment(request.auth!, id, body);
  }
}
