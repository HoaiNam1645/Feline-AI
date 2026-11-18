import { NotificationCategory, UserRole } from "@prisma/client";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  function setup(recipientIds = ["admin-1", "manager-1", "user-1"]) {
    const prisma = {
      user: { findMany: jest.fn().mockResolvedValue(recipientIds.map((id) => ({ id }))) },
      notification: {
        createMany: jest.fn().mockResolvedValue({ count: recipientIds.length }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      }
    };
    return { prisma, service: new NotificationsService(prisma as never) };
  }

  it("publishes a task notification once per recipient and excludes the actor", async () => {
    const { prisma, service } = setup(["admin-1", "actor-1", "user-1", "user-1"]);
    await service.forTask(prisma as never, {
      id: "task-1", code: "TASK-001", title: "Kiểm tra đơn", departmentCode: "TIKTOK",
      teamId: "team-1", createdById: "creator-1", assigneeId: "user-1"
    }, {
      actorUserId: "actor-1", eventType: "TASK_CREATED", title: "Công việc mới", message: "Đã tạo công việc"
    });

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ recipientUserId: "admin-1", category: NotificationCategory.TASK, entityId: "task-1" }),
        expect.objectContaining({ recipientUserId: "user-1", route: "/tasks?task=task-1" })
      ])
    });
    const data = prisma.notification.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data.some((item: { recipientUserId: string }) => item.recipientUserId === "actor-1")).toBe(false);
  });

  it("scopes task recipients to admin, matching managers and the task team", async () => {
    const { prisma, service } = setup();
    await service.forTask(prisma as never, {
      id: "task-1", code: "TASK-001", title: "Kiểm tra đơn", departmentCode: "ETSY",
      teamId: "team-etsy", createdById: "creator-1", assigneeId: null
    }, {
      actorUserId: "actor-1", eventType: "TASK_UPDATED", title: "Cập nhật", message: "Đã cập nhật"
    });

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(expect.arrayContaining([
      { role: UserRole.ADMIN },
      expect.objectContaining({ role: UserRole.MANAGER, departmentCode: "ETSY" }),
      { role: UserRole.USER, departmentCode: "ETSY", teamId: "team-etsy" }
    ]));
  });

  it("does not include users when a report is still a draft", async () => {
    const { prisma, service } = setup();
    await service.forReport(prisma as never, {
      id: "report-1", departmentCode: "TIKTOK", teamId: "team-1", reportDate: new Date("2026-11-17T00:00:00Z"),
      status: "DRAFT", createdById: "creator-1"
    }, {
      actorUserId: "actor-1", eventType: "REPORT_CREATED", title: "Báo cáo mới", message: "Đã tạo"
    }, false);

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR.some((entry: { role?: UserRole }) => entry.role === UserRole.USER)).toBe(false);
  });

  it("includes same-team users after a report is submitted", async () => {
    const { prisma, service } = setup();
    await service.forReport(prisma as never, {
      id: "report-1", departmentCode: "TIKTOK", teamId: "team-1", reportDate: new Date("2026-11-17T00:00:00Z"),
      status: "SUBMITTED", createdById: "creator-1", submittedById: "leader-1"
    }, {
      actorUserId: "actor-1", eventType: "REPORT_SUBMITTED", title: "Báo cáo đã gửi", message: "Đã gửi"
    }, true);

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR).toContainEqual({ role: UserRole.USER, departmentCode: "TIKTOK", teamId: "team-1" });
    expect(prisma.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ category: NotificationCategory.REPORT, route: "/daily-reports?team=team-1&date=2026-11-17&report=report-1" })])
    }));
  });

  it("marks only the signed-in user's notification as read", async () => {
    const { prisma, service } = setup();
    const session = { user: { id: "user-1" } };
    await service.markRead(session as never, "notification-1");
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "notification-1", recipientUserId: "user-1", readAt: null },
      data: { readAt: expect.any(Date) }
    });
  });
});
