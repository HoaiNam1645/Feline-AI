import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UserRole, UserStatus, WorkTaskStatus } from "@prisma/client";
import { AuthenticatedSession } from "../auth/auth.service";
import { TasksService } from "./tasks.service";

function session(role: UserRole, options: { id?: string; departmentCode?: string | null; teamId?: string | null } = {}): AuthenticatedSession {
  return {
    sessionId: "session-1",
    user: {
      id: options.id || "user-1",
      email: "member@example.com",
      displayName: "Thành viên",
      departmentCode: options.departmentCode === undefined ? "TIKTOK" : options.departmentCode,
      departmentId: null,
      teamId: options.teamId === undefined ? "team-a" : options.teamId,
      passwordResetRequired: false,
      role,
      status: UserStatus.ACTIVE
    },
    access: { platformAdmin: role === UserRole.ADMIN, grants: [] }
  };
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    code: "TASK-001",
    title: "Kiểm tra đơn",
    description: "Kiểm tra toàn bộ đơn cần xử lý",
    departmentCode: "TIKTOK",
    departmentName: "Phòng Sell TikTok",
    teamId: "team-a",
    agentId: "tiktok-ai",
    priority: "NORMAL",
    status: WorkTaskStatus.DRAFT,
    position: 2,
    progressPercent: 0,
    dueAt: new Date("2026-11-18T10:00:00.000Z"),
    estimatedMinutes: null,
    startedAt: null,
    activeTimeSeconds: 0,
    activeTimerStartedAt: null,
    submittedAt: null,
    completedAt: null,
    blockedReason: null,
    completionNote: null,
    archivedAt: null,
    archivedById: null,
    createdById: "admin-1",
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: "admin-1", displayName: "Admin", email: "admin@example.com" },
    assignee: null,
    team: { id: "team-a", code: "G9B", name: "G9B" },
    checklistItems: [],
    updates: [],
    timeEntries: [],
    ...overrides
  };
}

describe("TasksService assignment and board rules", () => {
  it("shows a user only their own tasks, unclaimed team tasks and unclaimed department tasks", async () => {
    const prisma = { workTask: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await service.list(session(UserRole.USER), {});

    const where = prisma.workTask.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({
      departmentCode: "TIKTOK",
      OR: [
        { assigneeId: "user-1" },
        { assigneeId: null, teamId: "team-a" },
        { assigneeId: null, teamId: null }
      ]
    });
  });

  it("does not expose another team's unclaimed tasks to a user without a team", async () => {
    const prisma = { workTask: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await service.list(session(UserRole.USER, { teamId: null }), {});

    const scope = prisma.workTask.findMany.mock.calls[0][0].where.AND[0];
    expect(scope.OR).toEqual([
      { assigneeId: "user-1" },
      { assigneeId: null, teamId: null }
    ]);
  });

  it("lets a team manager see their team and department-wide tasks only", async () => {
    const prisma = { workTask: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await service.list(session(UserRole.MANAGER), {});

    expect(prisma.workTask.findMany.mock.calls[0][0].where.AND[0]).toEqual({
      departmentCode: "TIKTOK",
      OR: [{ teamId: "team-a" }, { teamId: null }]
    });
  });

  it("filters historical tasks by the selected business date field and inclusive range", async () => {
    const prisma = { workTask: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await service.list(session(UserRole.ADMIN), {
      view: "ALL",
      dateField: "completedAt",
      from: "2026-10-01",
      to: "2026-10-31"
    });

    expect(prisma.workTask.findMany.mock.calls[0][0].where.AND).toContainEqual({
      completedAt: {
        gte: new Date("2026-09-30T17:00:00.000Z"),
        lt: new Date("2026-10-31T17:00:00.000Z")
      }
    });
  });

  it("returns only active tasks that have exceeded their estimate", async () => {
    const over = task({ estimatedMinutes: 240, activeTimeSeconds: 14_401, status: WorkTaskStatus.IN_PROGRESS });
    const within = task({ id: "task-2", estimatedMinutes: 240, activeTimeSeconds: 14_400, status: WorkTaskStatus.IN_PROGRESS });
    const prisma = { workTask: { findMany: jest.fn().mockResolvedValue([over, within]) } };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await expect(service.list(session(UserRole.ADMIN), { view: "OVER_ESTIMATE" })).resolves.toEqual([over]);
  });

  it("claims an unassigned task atomically and appends it to the assigned column", async () => {
    const current = task();
    const claimed = task({ status: WorkTaskStatus.ASSIGNED, assigneeId: "user-1", position: 8 });
    const tx = {
      workTask: {
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 7 } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(claimed)
      },
      workTaskUpdate: { create: jest.fn().mockResolvedValue({}) },
      accessAuditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      workTask: { findFirst: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await expect(service.claim(session(UserRole.USER), "task-1")).resolves.toBe(claimed);
    expect(tx.workTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { assigneeId: "user-1", status: WorkTaskStatus.ASSIGNED, position: 8 }
    }));
  });

  it("rejects the second member when two people try to claim the same task", async () => {
    const current = task();
    const tx = {
      workTask: {
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 1 } }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };
    const prisma = {
      workTask: { findFirst: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await expect(service.claim(session(UserRole.USER), "task-1")).rejects.toThrow("Công việc vừa được thành viên khác tiếp nhận");
  });

  it("returns an unstarted task to the end of the waiting column", async () => {
    const current = task({ status: WorkTaskStatus.ASSIGNED, assigneeId: "user-1" });
    const released = task({ position: 5 });
    const tx = {
      workTask: {
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 4 } }),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue(released)
      },
      workTaskUpdate: { create: jest.fn().mockResolvedValue({}) },
      accessAuditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      workTask: { findFirst: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await service.release(session(UserRole.USER), "task-1");
    expect(tx.workTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { assigneeId: null, status: WorkTaskStatus.DRAFT, position: 5 }
    });
  });

  it("does not allow a task to be returned after work has started", async () => {
    const current = task({ status: WorkTaskStatus.ASSIGNED, assigneeId: "user-1", startedAt: new Date() });
    const prisma = { workTask: { findFirst: jest.fn().mockResolvedValue(current) } };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await expect(service.release(session(UserRole.USER), "task-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("moves a draft to the end of the assigned column when a manager assigns a person", async () => {
    const current = task();
    const tx = {
      workTask: {
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue(task({ status: WorkTaskStatus.ASSIGNED, assigneeId: "member-2", position: 6 }))
      },
      workTaskUpdate: { create: jest.fn().mockResolvedValue({}) },
      accessAuditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      workTask: {
        findFirst: jest.fn().mockResolvedValue(current),
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 5 } })
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: "member-2", displayName: "Nhân viên", teamId: "team-a" }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await service.update(session(UserRole.MANAGER), "task-1", { assigneeId: "member-2" });

    expect(tx.workTask.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "task-1" },
      data: expect.objectContaining({ status: WorkTaskStatus.ASSIGNED, position: 6 })
    }));
  });

  it("rejects a reorder request containing a task outside the caller's scope", async () => {
    const prisma = { workTask: { findMany: jest.fn().mockResolvedValue([{ id: "task-1" }]) } };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await expect(service.reorder(session(UserRole.MANAGER), {
      status: WorkTaskStatus.DRAFT,
      taskIds: ["task-1", "task-other-team"]
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a manager create a task inside their own team", async () => {
    const created = task({ createdById: "user-1", teamId: "team-a" });
    const tx = {
      workTask: {
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 2 } }),
        create: jest.fn().mockResolvedValue(created)
      },
      workTaskUpdate: { create: jest.fn().mockResolvedValue({}) },
      accessAuditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      department: { findFirst: jest.fn().mockResolvedValue({ id: "department-1", code: "TIKTOK", name: "Phòng Sell TikTok", agentId: "tiktok-ai" }) },
      organizationTeam: { findFirst: jest.fn().mockResolvedValue({ id: "team-a" }) },
      workTask: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await expect(service.create(session(UserRole.MANAGER), {
      title: "Kiểm tra đơn hôm nay",
      description: "Hoàn tất kiểm tra và ghi nhận kết quả",
      departmentCode: "TIKTOK",
      teamId: "team-a",
      priority: "NORMAL",
      dueAt: "2026-11-18T10:00:00.000Z"
    })).resolves.toEqual(created);

    expect(tx.workTask.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ departmentCode: "TIKTOK", teamId: "team-a", createdById: "user-1" })
    }));
  });

  it("does not let a manager create a task for another department or team", async () => {
    const prisma = {
      department: { findFirst: jest.fn().mockResolvedValue({ id: "department-1", code: "TIKTOK", name: "Phòng Sell TikTok", agentId: "tiktok-ai" }) }
    };
    const service = new TasksService(prisma as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);
    const body = { title: "Công việc", description: "Nội dung công việc", priority: "NORMAL", dueAt: "2026-11-18T10:00:00.000Z" };

    await expect(service.create(session(UserRole.MANAGER), { ...body, departmentCode: "ETSY", teamId: "team-a" }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create(session(UserRole.MANAGER), { ...body, departmentCode: "TIKTOK", teamId: "team-b" }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps task creation unavailable to regular users", async () => {
    const service = new TasksService({} as never, { forTask: jest.fn().mockResolvedValue({ count: 1 }) } as never);
    await expect(service.create(session(UserRole.USER), {})).rejects.toBeInstanceOf(ForbiddenException);
  });
});
