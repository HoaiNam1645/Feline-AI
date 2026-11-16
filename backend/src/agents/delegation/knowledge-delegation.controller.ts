import { Body, Controller, Post, Req } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RequireRoles } from "../../auth/access-control";
import { AuthenticatedRequest } from "../../auth/access.guard";
import { KnowledgeDelegationService } from "./knowledge-delegation.service";

@Controller("agents/delegations")
export class KnowledgeDelegationController {
  constructor(private readonly delegations: KnowledgeDelegationService) {}

  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @Post("knowledge")
  delegate(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.delegations.delegate(
      {
        id: request.auth!.user.id,
        role: request.auth!.user.role,
        departmentCode: request.auth!.user.departmentCode,
        access: request.auth!.access
      },
      String(body.sourceAgentId || ""),
      String(body.targetAgentId || ""),
      String(body.question || "")
    );
  }
}
