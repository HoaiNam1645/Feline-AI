import { ForbiddenException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import { AuthenticatedSession } from "../auth/auth.service";
import { OfficeDelegationService } from "./office-delegation.service";

function session(access: AuthenticatedSession["access"]): AuthenticatedSession {
  return {
    sessionId: "session-1",
    user: {
      id: "user-1",
      email: "director@example.com",
      displayName: "Giám đốc",
      departmentCode: "EXECUTIVE",
      departmentId: null,
      teamId: null,
      passwordResetRequired: false,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE
    },
    access
  };
}

describe("OfficeDelegationService", () => {
  it("delegates an order question to real metrics and records the run", async () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    const prisma = {
      agentRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "run-1" }),
        update: jest.fn().mockResolvedValue({})
      },
      accessAuditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const metrics = {
      calculateDaily: jest.fn().mockResolvedValue({
        meta: {
          reportDate: "2026-11-12",
          timeZone: "Asia/Ho_Chi_Minh",
          generatedAtUtc: "2026-11-12T09:50:00.000Z"
        },
        intake: {
          orders: 140,
          comparison: { previousDayChangePercent: -19.1 }
        },
        sourceFreshness: [{ maxUpdatedAt: "2026-11-12 09:40:04" }]
      })
    };
    const service = new OfficeDelegationService(prisma as never, metrics as never);
    const stages: string[] = [];

    const result = await service.delegate(
      session({ platformAdmin: true, grants: [] }),
      { question: "Hôm nay Lemiex có bao nhiêu đơn?" },
      (stage) => stages.push(stage)
    );

    expect(result.metric.value).toBe(140);
    expect(result.source.access).toBe("read-only");
    expect(metrics.calculateDaily).toHaveBeenCalledWith(today, true);
    expect(stages).toEqual(["AUTHORIZED", "DISPATCHED", "PROCESSING", "RESULT_READY", "COMPLETED"]);
    expect(prisma.agentRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "COMPLETED", inputTokens: 0, outputTokens: 0 })
    }));
  });

  it("denies delegation when the user cannot read Lemiex data", async () => {
    const prisma = {
      agentRun: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      accessAuditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const service = new OfficeDelegationService(prisma as never, { calculateDaily: jest.fn() } as never);
    const actor = session({
      platformAdmin: false,
      grants: [{
        id: "grant-1",
        agentId: "ceo-ai",
        actions: ["run"],
        capabilityIds: ["ceo.hr.ask"],
        dataScopeIds: ["ceo.hr.knowledge"],
        expiresAt: null
      }]
    });
    actor.user.role = UserRole.MANAGER;

    await expect(service.delegate(
      actor,
      { question: "Hôm nay Lemiex có bao nhiêu đơn?" },
      jest.fn()
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.agentRun.create).not.toHaveBeenCalled();
    expect(prisma.accessAuditEvent.create).toHaveBeenCalled();
  });
});
