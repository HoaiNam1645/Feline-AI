import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RequireRoles } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { requestMetadata } from "../auth/auth-http";
import { AdminAccessService } from "./admin-access.service";
import { AiOperationsControlService } from "../operations/ai-operations-control.service";
import { RequestLogsService } from "../observability/request-logs.service";
import { ChatQuestionEvaluationsService } from "./chat-question-evaluations.service";

@RequireRoles(UserRole.ADMIN)
@Controller("admin")
export class AdminAccessController {
  constructor(
    private readonly admin: AdminAccessService,
    private readonly aiOperations: AiOperationsControlService,
    private readonly requestLogs: RequestLogsService,
    private readonly questionEvaluations: ChatQuestionEvaluationsService
  ) {}

  @Get("chat-question-evaluations")
  questionEvaluationList(@Query() query: Record<string, unknown>) {
    return this.questionEvaluations.list(query);
  }

  @Patch("chat-question-evaluations/:id")
  updateQuestionEvaluation(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest
  ) {
    return this.questionEvaluations.update(id, body, request.auth!.user.id);
  }

  @Get("request-logs")
  logs(@Query() query: Record<string, unknown>) {
    return this.requestLogs.list(query);
  }

  @Get("ai-operations/audits")
  aiAudits(@Query() query: Record<string, unknown>) {
    return this.aiOperations.listAudits(query);
  }

  @Get("ai-operations/usage")
  aiUsage(@Query() query: Record<string, unknown>) {
    return this.aiOperations.dailyUsage(query);
  }

  @Get("ai-operations/policies")
  aiPolicies() {
    return this.aiOperations.listPolicies();
  }

  @Put("ai-operations/policies")
  upsertAiPolicy(@Body() body: Record<string, unknown>) {
    return this.aiOperations.upsertPolicy(body);
  }

  @Get("users")
  listUsers() {
    return this.admin.listUsers();
  }

  @Get("access-catalog")
  catalog() {
    return this.admin.accessCatalog();
  }

  @Post("users")
  createUser(@Body() body: Record<string, unknown>, @Req() request: AuthenticatedRequest) {
    return this.admin.createUser(body, request.auth!.user.id, requestMetadata(request));
  }

  @Post("organization/sync-tiktok-team")
  syncTiktokTeam(@Body() body: Record<string, unknown>, @Req() request: AuthenticatedRequest) {
    return this.admin.syncTiktokTeam(body, request.auth!.user.id, requestMetadata(request));
  }

  @Patch("users/:id")
  updateUser(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest
  ) {
    return this.admin.updateUser(id, body, request.auth!.user.id, requestMetadata(request));
  }

  @Post("access-grants")
  createGrant(@Body() body: Record<string, unknown>, @Req() request: AuthenticatedRequest) {
    return this.admin.createGrant(body, request.auth!.user.id, requestMetadata(request));
  }

  @Patch("access-grants/:id")
  updateGrant(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest
  ) {
    return this.admin.updateGrant(id, body, request.auth!.user.id, requestMetadata(request));
  }

  @Delete("access-grants/:id")
  async revokeGrant(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    await this.admin.revokeGrant(id, request.auth!.user.id, requestMetadata(request));
    return { success: true };
  }
}
