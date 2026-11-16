import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { Request } from "express";
import {
  ACCESS_AGENT,
  ACCESS_PUBLIC,
  ACCESS_ROLES,
  AgentAccessRequirement,
  hasAgentAccess
} from "./access-control";
import { AuthService, AuthenticatedSession } from "./auth.service";
import { readCookie, requestMetadata } from "./auth-http";

export type AuthenticatedRequest = Request & { auth?: AuthenticatedSession };

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(ACCESS_PUBLIC, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.auth.authenticate(
      readCookie(request, this.auth.cookieName())
    );
    request.auth = session;

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ACCESS_ROLES, [
      context.getHandler(),
      context.getClass()
    ]);
    if (roles?.length && !roles.includes(session.user.role)) {
      await this.deny(request, session, { reason: "role", requiredRoles: roles });
    }

    const requirement = this.reflector.getAllAndOverride<AgentAccessRequirement>(ACCESS_AGENT, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!requirement) return true;

    const dynamicCapability = requirement.capabilityBodyField
      ? request.body?.[requirement.capabilityBodyField]
      : undefined;
    const capabilityId = typeof dynamicCapability === "string" ? dynamicCapability : undefined;
    if (!hasAgentAccess(session.access, requirement, capabilityId)) {
      await this.deny(request, session, {
        reason: "agent_access",
        agentId: requirement.agentId,
        action: requirement.action,
        capabilityId: requirement.capabilityId || capabilityId || null,
        dataScopeIds: requirement.dataScopeIds || []
      });
    }
    return true;
  }

  private async deny(
    request: AuthenticatedRequest,
    session: AuthenticatedSession,
    detail: Record<string, unknown>
  ): Promise<never> {
    await this.auth.auditAccessDenied(session.user.id, requestMetadata(request), detail);
    throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
  }
}
