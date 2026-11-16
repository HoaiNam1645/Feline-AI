import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgentAccessGrant,
  Prisma,
  UserRole,
  UserStatus
} from "@prisma/client";
import { hash } from "bcryptjs";
import { AGENT_DEFINITIONS, findAgentDefinition } from "../agents/agent-definition";
import {
  ACCESS_ACTIONS,
  AccessAction
} from "../auth/access-control";
import { assertValidPassword, normalizeEmail } from "../auth/auth.constants";
import { RequestMetadata } from "../auth/auth-http";
import { PrismaService } from "../database/prisma.service";

const MANAGED_ROLES = [UserRole.MANAGER, UserRole.USER] as const;
const ROLE_ACTIONS: Record<"MANAGER" | "USER", AccessAction[]> = {
  MANAGER: ["view", "run", "export", "approve", "manage_members", "view_audit", "view_cost"],
  USER: ["view", "run", "export", "view_audit", "view_cost"]
};

interface GrantInput {
  userId?: unknown;
  agentId?: unknown;
  capabilityIds?: unknown;
  dataScopeIds?: unknown;
  actions?: unknown;
  expiresAt?: unknown;
}

@Injectable()
export class AdminAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        accessGrants: {
          where: { revokedAt: null },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      departmentCode: user.departmentCode,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      grants: user.accessGrants.map((grant) => this.publicGrant(grant))
    }));
  }

  async accessCatalog() {
    const scopes = await this.prisma.dataScope.findMany({
      where: { isActive: true },
      orderBy: [{ agentId: "asc" }, { name: "asc" }]
    });
    return {
      actions: ACCESS_ACTIONS,
      agents: AGENT_DEFINITIONS.map((agent) => ({
        id: agent.id,
        name: agent.name,
        domain: agent.domain,
        capabilities: agent.capabilities.map((capability) => ({
          id: capability.id,
          name: capability.name,
          description: capability.description,
          status: capability.status,
          riskLevel: capability.riskLevel
        })),
        dataScopes: scopes
          .filter((scope) => scope.agentId === agent.id)
          .map((scope) => ({
            id: scope.id,
            name: scope.name,
            description: scope.description
          }))
      }))
    };
  }

  async createUser(
    body: Record<string, unknown>,
    actorUserId: string,
    metadata: RequestMetadata
  ) {
    const email = normalizeEmail(body.email);
    const displayName = this.requiredText(body.displayName, "Tên hiển thị", 120);
    const role = this.managedRole(body.role);
    const departmentCode = this.optionalCode(body.departmentCode);
    if (!email || !email.includes("@")) throw new BadRequestException("Email không hợp lệ");
    try {
      assertValidPassword(body.password);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Mật khẩu không hợp lệ");
    }
    const passwordHash = await hash(body.password, 12);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, displayName, departmentCode, role, passwordHash }
        });
        await tx.accessAuditEvent.create({
          data: {
            actorUserId,
            eventType: "USER_CREATED",
            targetType: "User",
            targetId: user.id,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            detail: { email, displayName, role }
          }
        });
        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          departmentCode: user.departmentCode,
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          grants: []
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Email đã tồn tại");
      }
      throw error;
    }
  }

  async updateUser(
    userId: string,
    body: Record<string, unknown>,
    actorUserId: string,
    metadata: RequestMetadata
  ) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new NotFoundException("Không tìm thấy người dùng");
    if (current.role === UserRole.ADMIN) {
      throw new ForbiddenException("Tài khoản Admin không được sửa tại màn hình phân quyền Agent");
    }

    const data: Prisma.UserUpdateInput = {};
    if (body.displayName !== undefined) {
      data.displayName = this.requiredText(body.displayName, "Tên hiển thị", 120);
    }
    if (body.departmentCode !== undefined) data.departmentCode = this.optionalCode(body.departmentCode);
    if (body.role !== undefined) data.role = this.managedRole(body.role);
    if (body.status !== undefined) {
      const status = String(body.status);
      if (status !== UserStatus.ACTIVE && status !== UserStatus.DISABLED) {
        throw new BadRequestException("Trạng thái tài khoản không hợp lệ");
      }
      data.status = status as UserStatus;
      data.lockedUntil = null;
      data.failedLoginAttempts = 0;
    }
    if (body.password !== undefined && body.password !== "") {
      try {
        assertValidPassword(body.password);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Mật khẩu không hợp lệ");
      }
      data.passwordHash = await hash(body.password, 12);
      data.passwordChangedAt = new Date();
    }
    if (!Object.keys(data).length) throw new BadRequestException("Không có thay đổi hợp lệ");

    const revokeSessions = body.password !== undefined || data.status === UserStatus.DISABLED || data.role !== undefined;
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data });
      let grantsAdjusted = 0;
      if (data.role === UserRole.USER) {
        const grants = await tx.agentAccessGrant.findMany({
          where: { userId, revokedAt: null }
        });
        for (const grant of grants) {
          const actions = this.jsonStringArray(grant.actions)
            .filter((action): action is AccessAction => ROLE_ACTIONS.USER.includes(action as AccessAction));
          if (actions.length !== this.jsonStringArray(grant.actions).length) {
            await tx.agentAccessGrant.update({ where: { id: grant.id }, data: { actions } });
            grantsAdjusted += 1;
          }
        }
      }
      if (revokeSessions) {
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }
      await tx.accessAuditEvent.create({
        data: {
          actorUserId,
          eventType: "USER_UPDATED",
          targetType: "User",
          targetId: userId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          detail: {
            before: { displayName: current.displayName, role: current.role, status: current.status },
            after: { displayName: user.displayName, departmentCode: user.departmentCode, role: user.role, status: user.status },
            passwordReset: body.password !== undefined && body.password !== "",
            sessionsRevoked: revokeSessions,
            grantsAdjusted
          }
        }
      });
      return user;
    });
    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      departmentCode: updated.departmentCode,
      role: updated.role,
      status: updated.status,
      lastLoginAt: updated.lastLoginAt,
      createdAt: updated.createdAt
    };
  }

  async createGrant(
    body: GrantInput,
    actorUserId: string,
    metadata: RequestMetadata
  ) {
    const userId = this.requiredText(body.userId, "Người dùng", 100);
    const existing = await this.prisma.agentAccessGrant.findFirst({
      where: { userId, agentId: String(body.agentId || ""), revokedAt: null }
    });
    if (existing) throw new ConflictException("Người dùng đã có quyền đang hoạt động cho Agent này");
    const input = await this.validateGrantInput(body, userId);
    const grant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.agentAccessGrant.create({
        data: { ...input, userId, grantedById: actorUserId }
      });
      await tx.accessAuditEvent.create({
        data: {
          actorUserId,
          eventType: "ACCESS_GRANT_CREATED",
          targetType: "AgentAccessGrant",
          targetId: created.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          detail: this.grantAudit(created)
        }
      });
      return created;
    });
    return this.publicGrant(grant);
  }

  async updateGrant(
    grantId: string,
    body: GrantInput,
    actorUserId: string,
    metadata: RequestMetadata
  ) {
    const current = await this.prisma.agentAccessGrant.findUnique({ where: { id: grantId } });
    if (!current || current.revokedAt) throw new NotFoundException("Không tìm thấy quyền đang hoạt động");
    const input = await this.validateGrantInput({
      userId: current.userId,
      agentId: body.agentId ?? current.agentId,
      capabilityIds: body.capabilityIds ?? current.capabilityIds,
      dataScopeIds: body.dataScopeIds ?? current.dataScopeIds,
      actions: body.actions ?? current.actions,
      expiresAt: body.expiresAt === undefined ? current.expiresAt : body.expiresAt
    }, current.userId);
    const grant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.agentAccessGrant.update({ where: { id: grantId }, data: input });
      await tx.accessAuditEvent.create({
        data: {
          actorUserId,
          eventType: "ACCESS_GRANT_UPDATED",
          targetType: "AgentAccessGrant",
          targetId: grantId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          detail: {
            before: this.grantAudit(current),
            after: this.grantAudit(updated)
          }
        }
      });
      return updated;
    });
    return this.publicGrant(grant);
  }

  async revokeGrant(
    grantId: string,
    actorUserId: string,
    metadata: RequestMetadata
  ): Promise<void> {
    const current = await this.prisma.agentAccessGrant.findUnique({ where: { id: grantId } });
    if (!current || current.revokedAt) throw new NotFoundException("Không tìm thấy quyền đang hoạt động");
    await this.prisma.$transaction(async (tx) => {
      await tx.agentAccessGrant.update({ where: { id: grantId }, data: { revokedAt: new Date() } });
      await tx.accessAuditEvent.create({
        data: {
          actorUserId,
          eventType: "ACCESS_GRANT_REVOKED",
          targetType: "AgentAccessGrant",
          targetId: grantId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          detail: this.grantAudit(current)
        }
      });
    });
  }

  private async validateGrantInput(body: GrantInput, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Không tìm thấy người dùng");
    if (user.role === UserRole.ADMIN) throw new BadRequestException("Admin không cần Access Grant");
    if (user.status === UserStatus.DISABLED) throw new BadRequestException("Không thể cấp quyền cho tài khoản đã vô hiệu hóa");
    const agentId = this.requiredText(body.agentId, "Agent", 100);
    const agent = findAgentDefinition(agentId);
    if (!agent) throw new BadRequestException("Agent chưa được đăng ký");

    const capabilityIds = this.stringArray(body.capabilityIds, "Capability");
    const knownCapabilities = new Set(agent.capabilities.map((item) => item.id));
    if (capabilityIds.some((id) => !knownCapabilities.has(id))) {
      throw new BadRequestException("Danh sách capability chứa giá trị không hợp lệ");
    }
    const dataScopeIds = this.stringArray(body.dataScopeIds, "Data Scope");
    const scopes = await this.prisma.dataScope.findMany({
      where: { id: { in: dataScopeIds }, agentId, isActive: true },
      select: { id: true }
    });
    if (scopes.length !== dataScopeIds.length) {
      throw new BadRequestException("Danh sách Data Scope chứa giá trị không hợp lệ");
    }
    const actions = this.stringArray(body.actions, "Action") as AccessAction[];
    const allowedActions = ROLE_ACTIONS[user.role as "MANAGER" | "USER"];
    if (actions.some((action) => !ACCESS_ACTIONS.includes(action) || !allowedActions.includes(action))) {
      throw new BadRequestException(`Role ${user.role} không được cấp một hoặc nhiều action đã chọn`);
    }
    if (actions.includes("run") && !capabilityIds.length) {
      throw new BadRequestException("Action run cần ít nhất một capability");
    }
    if (actions.includes("manage_members") && user.role !== UserRole.MANAGER) {
      throw new BadRequestException("Chỉ Manager được cấp quyền quản lý thành viên");
    }
    return {
      agentId,
      capabilityIds,
      dataScopeIds,
      actions,
      expiresAt: this.expiration(body.expiresAt)
    };
  }

  private managedRole(value: unknown): "MANAGER" | "USER" {
    const role = String(value || "");
    if (!MANAGED_ROLES.includes(role as typeof MANAGED_ROLES[number])) {
      throw new BadRequestException("Chỉ có thể tạo hoặc cập nhật Manager/User tại màn hình này");
    }
    return role as "MANAGER" | "USER";
  }

  private requiredText(value: unknown, label: string, max: number): string {
    const text = String(value ?? "").trim();
    if (!text) throw new BadRequestException(`${label} là bắt buộc`);
    if (text.length > max) throw new BadRequestException(`${label} vượt quá ${max} ký tự`);
    return text;
  }

  private optionalCode(value: unknown): string | null {
    const code = String(value ?? "").trim().toUpperCase();
    if (!code) return null;
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
      throw new BadRequestException("Mã phòng ban chỉ gồm chữ, số, gạch ngang hoặc gạch dưới");
    }
    return code;
  }

  private stringArray(value: unknown, label: string): string[] {
    if (!Array.isArray(value)) throw new BadRequestException(`${label} phải là danh sách`);
    const result = [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
    if (result.length !== value.length) throw new BadRequestException(`${label} chứa giá trị không hợp lệ hoặc trùng lặp`);
    return result;
  }

  private expiration(value: unknown): Date | null {
    if (value === null || value === undefined || value === "") return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      throw new BadRequestException("Ngày hết hạn phải nằm trong tương lai");
    }
    return date;
  }

  private jsonStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  private publicGrant(grant: AgentAccessGrant) {
    return {
      id: grant.id,
      agentId: grant.agentId,
      capabilityIds: grant.capabilityIds,
      dataScopeIds: grant.dataScopeIds,
      actions: grant.actions,
      expiresAt: grant.expiresAt,
      createdAt: grant.createdAt
    };
  }

  private grantAudit(grant: AgentAccessGrant): Prisma.InputJsonObject {
    return {
      userId: grant.userId,
      agentId: grant.agentId,
      capabilityIds: grant.capabilityIds,
      dataScopeIds: grant.dataScopeIds,
      actions: grant.actions,
      expiresAt: grant.expiresAt?.toISOString() ?? null
    };
  }
}
