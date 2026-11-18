import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { AgentAccessGrant, Prisma, User, UserRole, UserStatus } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { requiredNumber, requiredString } from "../config/runtime-config";
import { PrismaService } from "../database/prisma.service";
import { assertValidPassword, normalizeEmail } from "./auth.constants";
import { hashSessionToken, RequestMetadata } from "./auth-http";
import {
  ACCESS_ACTIONS,
  AccessAction,
  AccessProfile
} from "./access-control";

const DUMMY_PASSWORD_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxXjjH0g9KQOM6.Njl3QBZL2D6i";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  departmentCode: string | null;
  departmentId: string | null;
  teamId: string | null;
  passwordResetRequired: boolean;
  role: User["role"];
  status: User["status"];
}

export interface AuthenticatedSession {
  sessionId: string;
  user: PublicUser;
  access: AccessProfile;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  cookieName(): string {
    return requiredString("AUTH_COOKIE_NAME", "feline_session");
  }

  cookieSecure(): boolean {
    return process.env.AUTH_COOKIE_SECURE === "true";
  }

  sessionTtlSeconds(): number {
    return requiredNumber("AUTH_SESSION_TTL_HOURS", 168) * 60 * 60;
  }

  async login(emailInput: unknown, passwordInput: unknown, metadata: RequestMetadata) {
    const email = normalizeEmail(emailInput);
    const password = typeof passwordInput === "string" ? passwordInput : "";
    if (!email || !password) throw new BadRequestException("Email và mật khẩu là bắt buộc");

    const user = await this.prisma.user.findUnique({ where: { email } });
    const now = new Date();
    if (!user) {
      await compare(password, DUMMY_PASSWORD_HASH);
      await this.audit(null, "AUTH_LOGIN_FAILED", metadata, { email, reason: "invalid_credentials" });
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }

    if (user.status === UserStatus.DISABLED) {
      await this.audit(user.id, "AUTH_LOGIN_FAILED", metadata, { reason: "disabled" });
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      await this.audit(user.id, "AUTH_LOGIN_BLOCKED", metadata, { lockedUntil: user.lockedUntil });
      throw new HttpException("Tài khoản đang bị khóa tạm thời", 429);
    }

    const passwordMatches = await compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordFailedLogin(user, metadata);
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + this.sessionTtlSeconds() * 1000);
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: UserStatus.ACTIVE,
          lastLoginAt: now
        }
      });
      const created = await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: hashSessionToken(token),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          expiresAt
        }
      });
      await tx.accessAuditEvent.create({
        data: {
          actorUserId: user.id,
          eventType: "AUTH_LOGIN_SUCCEEDED",
          targetType: "Session",
          targetId: created.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      });
      return created;
    });

    return { token, expiresAt, sessionId: session.id, user: this.publicUser(user) };
  }

  async authenticate(token: string | null): Promise<AuthenticatedSession> {
    if (!token) throw new UnauthorizedException("Chưa đăng nhập");
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: {
        user: {
          include: {
            accessGrants: { where: { revokedAt: null } }
          }
        }
      }
    });
    const now = new Date();
    if (
      !session
      || session.revokedAt
      || session.expiresAt <= now
      || session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException("Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
    }
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now }
    });
    return {
      sessionId: session.id,
      user: this.publicUser(session.user),
      access: this.accessProfile(session.user.role, session.user.accessGrants, now)
    };
  }

  async logout(token: string | null, metadata: RequestMetadata): Promise<void> {
    if (!token) return;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) }
    });
    if (!session || session.revokedAt) return;
    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
      this.prisma.accessAuditEvent.create({
        data: {
          actorUserId: session.userId,
          eventType: "AUTH_LOGOUT",
          targetType: "Session",
          targetId: session.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      })
    ]);
  }

  async refresh(token: string | null, metadata: RequestMetadata) {
    const current = await this.authenticate(token);
    const nextToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.sessionTtlSeconds() * 1000);
    const next = await this.prisma.$transaction(async (tx) => {
      await tx.session.update({ where: { id: current.sessionId }, data: { revokedAt: new Date() } });
      const created = await tx.session.create({
        data: {
          userId: current.user.id,
          tokenHash: hashSessionToken(nextToken),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          expiresAt
        }
      });
      await tx.accessAuditEvent.create({
        data: {
          actorUserId: current.user.id,
          eventType: "AUTH_SESSION_REFRESHED",
          targetType: "Session",
          targetId: created.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          detail: { previousSessionId: current.sessionId }
        }
      });
      return created;
    });
    return { token: nextToken, expiresAt, sessionId: next.id, user: current.user };
  }

  async changePassword(
    token: string | null,
    currentPassword: unknown,
    newPassword: unknown,
    metadata: RequestMetadata
  ): Promise<void> {
    const current = await this.authenticate(token);
    if (typeof currentPassword !== "string") throw new BadRequestException("Mật khẩu hiện tại là bắt buộc");
    try {
      assertValidPassword(newPassword);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Mật khẩu mới không hợp lệ");
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException("Mật khẩu mới phải khác mật khẩu hiện tại");
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: current.user.id } });
    if (!await compare(currentPassword, user.passwordHash)) {
      await this.audit(user.id, "AUTH_PASSWORD_CHANGE_FAILED", metadata, { reason: "invalid_current_password" });
      throw new UnauthorizedException("Mật khẩu hiện tại không đúng");
    }
    const passwordHash = await hash(newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date(), passwordResetRequired: false, failedLoginAttempts: 0, lockedUntil: null }
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await tx.accessAuditEvent.create({
        data: {
          actorUserId: user.id,
          eventType: "AUTH_PASSWORD_CHANGED",
          targetType: "User",
          targetId: user.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      });
    });
  }

  async auditAccessDenied(
    actorUserId: string,
    metadata: RequestMetadata,
    detail: Record<string, unknown>
  ): Promise<void> {
    await this.audit(
      actorUserId,
      "ACCESS_DENIED",
      metadata,
      detail as Prisma.InputJsonValue
    );
  }

  private async recordFailedLogin(user: User, metadata: RequestMetadata): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const maxAttempts = requiredNumber("AUTH_MAX_FAILED_ATTEMPTS", 5);
    const shouldLock = attempts >= maxAttempts;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + requiredNumber("AUTH_LOCK_MINUTES", 15) * 60_000)
      : null;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          status: shouldLock ? UserStatus.LOCKED : user.status,
          lockedUntil
        }
      }),
      this.prisma.accessAuditEvent.create({
        data: {
          actorUserId: user.id,
          eventType: "AUTH_LOGIN_FAILED",
          targetType: "User",
          targetId: user.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          detail: { attempts, locked: shouldLock, lockedUntil } as Prisma.InputJsonValue
        }
      })
    ]);
  }

  private async audit(
    actorUserId: string | null,
    eventType: string,
    metadata: RequestMetadata,
    detail: Prisma.InputJsonValue
  ): Promise<void> {
    await this.prisma.accessAuditEvent.create({
      data: {
        actorUserId,
        eventType,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        detail
      }
    });
  }

  private publicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      departmentCode: user.departmentCode,
      departmentId: user.departmentId,
      teamId: user.teamId,
      passwordResetRequired: user.passwordResetRequired,
      role: user.role,
      status: user.status
    };
  }

  private accessProfile(
    role: UserRole,
    grants: AgentAccessGrant[],
    now: Date
  ): AccessProfile {
    return {
      platformAdmin: role === UserRole.ADMIN,
      grants: grants
        .filter((grant) => !grant.expiresAt || grant.expiresAt > now)
        .map((grant) => ({
          id: grant.id,
          agentId: grant.agentId,
          capabilityIds: this.jsonStringArray(grant.capabilityIds),
          dataScopeIds: this.jsonStringArray(grant.dataScopeIds),
          actions: this.jsonStringArray(grant.actions)
            .filter((value): value is AccessAction =>
              ACCESS_ACTIONS.includes(value as AccessAction)
            ),
          expiresAt: grant.expiresAt?.toISOString() ?? null
        }))
    };
  }

  private jsonStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }
}
