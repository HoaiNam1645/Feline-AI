import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { TeamDailyReportStatus, UserRole, UserStatus } from "@prisma/client";
import { AuthenticatedSession } from "../auth/auth.service";
import { DailyReportsService, parseCalendarDate } from "./daily-reports.service";

function session(role: UserRole, options: { teamId?: string | null; departmentId?: string | null } = {}): AuthenticatedSession {
  return {
    sessionId: "session-1",
    user: {
      id: "user-1",
      email: "user@feline.com",
      displayName: "Người dùng",
      departmentCode: "TIKTOK",
      departmentId: options.departmentId === undefined ? "department-1" : options.departmentId,
      teamId: options.teamId === undefined ? "team-a" : options.teamId,
      passwordResetRequired: false,
      role,
      status: UserStatus.ACTIVE
    },
    access: { platformAdmin: role === UserRole.ADMIN, grants: [] }
  };
}

function report(status: TeamDailyReportStatus = TeamDailyReportStatus.SUBMITTED) {
  return {
    id: "report-1",
    teamId: "team-a",
    status,
    summary: "Tình hình ổn định",
    completedWork: "Đã hoàn thành kế hoạch",
    inProgressWork: "",
    blockers: "",
    nextPlan: "Tiếp tục xử lý"
  };
}

describe("DailyReportsService", () => {
  it("limits a user to their team and hides draft reports", async () => {
    const prisma = {
      organizationTeam: { findFirst: jest.fn().mockResolvedValue({ id: "team-a" }) },
      teamDailyReport: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new DailyReportsService(prisma as never, { forReport: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await service.list(session(UserRole.USER), { teamId: "team-a", from: "2026-11-01", to: "2026-11-17" });

    expect(prisma.organizationTeam.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ id: "team-a", isActive: true }, { id: "team-a" }] }
    }));
    expect(prisma.teamDailyReport.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      teamId: "team-a",
      status: { not: TeamDailyReportStatus.DRAFT }
    }));
  });

  it("does not let a manager write a report for another team", async () => {
    const prisma = { organizationTeam: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new DailyReportsService(prisma as never, { forReport: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await expect(service.create(session(UserRole.MANAGER), {
      teamId: "team-b",
      reportDate: "2026-11-17",
      summary: "Tóm tắt",
      completedWork: "Kết quả",
      nextPlan: "Kế hoạch"
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not expose a draft report detail to a user", async () => {
    const prisma = {
      teamDailyReport: { findUnique: jest.fn().mockResolvedValue(report(TeamDailyReportStatus.DRAFT)) },
      organizationTeam: { findFirst: jest.fn().mockResolvedValue({ id: "team-a" }) }
    };
    const service = new DailyReportsService(prisma as never, { forReport: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await expect(service.detail(session(UserRole.USER), "report-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires the core sections before a leader submits", async () => {
    const prisma = {
      teamDailyReport: { findUnique: jest.fn().mockResolvedValue({ ...report(TeamDailyReportStatus.DRAFT), nextPlan: "" }) },
      organizationTeam: { findFirst: jest.fn().mockResolvedValue({ id: "team-a" }) }
    };
    const service = new DailyReportsService(prisma as never, { forReport: jest.fn().mockResolvedValue({ count: 1 }) } as never);

    await expect(service.submit(session(UserRole.MANAGER), "report-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invalid calendar dates instead of normalizing them", () => {
    expect(() => parseCalendarDate("2026-02-31", "Ngày báo cáo")).toThrow(BadRequestException);
    expect(() => parseCalendarDate("17/11/2026", "Ngày báo cáo")).toThrow(BadRequestException);
  });
});
