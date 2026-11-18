import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TeamDailyReportStatus, UserRole } from "@prisma/client";
import { AuthenticatedSession } from "../auth/auth.service";
import { PrismaService } from "../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const reportInclude = {
  team: { select: { id: true, code: true, name: true, departmentId: true } },
  createdBy: { select: { id: true, displayName: true, role: true } },
  submittedBy: { select: { id: true, displayName: true, role: true } },
  acknowledgedBy: { select: { id: true, displayName: true, role: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { actor: { select: { id: true, displayName: true, role: true, teamId: true } } }
  }
};

type ReportFields = {
  summary: string;
  completedWork: string;
  inProgressWork: string;
  blockers: string;
  nextPlan: string;
};

@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async teams(session: AuthenticatedSession, dateInput?: string) {
    const date = dateInput ? parseCalendarDate(dateInput, "Ngày báo cáo") : todayInVietnam();
    const teams = await this.prisma.organizationTeam.findMany({
      where: { isActive: true, ...this.teamScope(session) },
      select: {
        id: true,
        code: true,
        name: true,
        departmentId: true,
        department: { select: { code: true, name: true } },
        dailyReports: {
          where: { reportDate: date, ...(session.user.role === UserRole.USER ? { status: { not: TeamDailyReportStatus.DRAFT } } : {}) },
          select: { id: true, status: true, submittedAt: true, acknowledgedAt: true },
          take: 1
        }
      },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }]
    });
    return teams.map(({ dailyReports, ...team }) => ({ ...team, report: dailyReports[0] || null }));
  }

  async list(session: AuthenticatedSession, filters: { teamId?: string; from?: string; to?: string }) {
    const teamId = this.requiredText(filters.teamId, "Team", 64);
    await this.assertTeamVisible(session, teamId);
    const from = filters.from ? parseCalendarDate(filters.from, "Từ ngày") : daysBeforeVietnam(44);
    const to = filters.to ? parseCalendarDate(filters.to, "Đến ngày") : todayInVietnam();
    if (from > to) throw new BadRequestException("Khoảng ngày báo cáo không hợp lệ");
    const endExclusive = new Date(to);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    return this.prisma.teamDailyReport.findMany({
      where: {
        teamId,
        reportDate: { gte: from, lt: endExclusive },
        ...(session.user.role === UserRole.USER ? { status: { not: TeamDailyReportStatus.DRAFT } } : {})
      },
      include: reportInclude,
      orderBy: { reportDate: "desc" },
      take: 180
    });
  }

  async detail(session: AuthenticatedSession, id: string) {
    const report = await this.prisma.teamDailyReport.findUnique({ where: { id }, include: reportInclude });
    if (!report) throw new NotFoundException("Không tìm thấy báo cáo");
    await this.assertTeamVisible(session, report.teamId);
    if (session.user.role === UserRole.USER && report.status === TeamDailyReportStatus.DRAFT) {
      throw new ForbiddenException("Báo cáo chưa được Leader gửi");
    }
    return report;
  }

  async create(session: AuthenticatedSession, body: Record<string, unknown>) {
    const teamId = this.requiredText(body.teamId, "Team", 64);
    const team = await this.assertTeamWritable(session, teamId);
    const reportDate = parseCalendarDate(this.requiredText(body.reportDate, "Ngày báo cáo", 10), "Ngày báo cáo");
    const data = this.reportFields(body) as ReportFields;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const report = await tx.teamDailyReport.create({
          data: {
            departmentId: team.departmentId,
            departmentCode: team.department.code,
            departmentName: team.department.name,
            teamId: team.id,
            reportDate,
            createdById: session.user.id,
            ...data
          },
          include: reportInclude
        });
        await this.audit(tx, session.user.id, "TEAM_DAILY_REPORT_CREATED", report.id, { teamId, reportDate: formatCalendarDate(reportDate) });
        await this.notifications.forReport(tx, report, {
          actorUserId: session.user.id,
          eventType: "REPORT_CREATED",
          title: "Báo cáo mới được tạo",
          message: `${session.user.displayName} đã tạo báo cáo ngày ${formatCalendarDate(report.reportDate)} của ${report.team.name}.`
        }, false);
        return report;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Team đã có báo cáo trong ngày này");
      }
      throw error;
    }
  }

  async update(session: AuthenticatedSession, id: string, body: Record<string, unknown>) {
    const current = await this.editableReport(session, id);
    const fields = this.reportFields(body, true);
    if (!Object.keys(fields).length) throw new BadRequestException("Không có nội dung cần cập nhật");
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.teamDailyReport.update({ where: { id }, data: fields, include: reportInclude });
      await this.audit(tx, session.user.id, "TEAM_DAILY_REPORT_UPDATED", id, { teamId: current.teamId });
      await this.notifications.forReport(tx, report, {
        actorUserId: session.user.id,
        eventType: "REPORT_UPDATED",
        title: "Báo cáo đã được cập nhật",
        message: `${session.user.displayName} đã cập nhật báo cáo ngày ${formatCalendarDate(report.reportDate)} của ${report.team.name}.`
      }, false);
      return report;
    });
  }

  async submit(session: AuthenticatedSession, id: string) {
    const current = await this.editableReport(session, id);
    if (!current.summary.trim() || !current.completedWork.trim() || !current.nextPlan.trim()) {
      throw new BadRequestException("Cần điền Tóm tắt, Kết quả hôm nay và Kế hoạch tiếp theo trước khi gửi");
    }
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.teamDailyReport.update({
        where: { id },
        data: { status: TeamDailyReportStatus.SUBMITTED, submittedById: session.user.id, submittedAt: new Date(), acknowledgedById: null, acknowledgedAt: null },
        include: reportInclude
      });
      await this.audit(tx, session.user.id, "TEAM_DAILY_REPORT_SUBMITTED", id, { teamId: current.teamId });
      await this.notifications.forReport(tx, report, {
        actorUserId: session.user.id,
        eventType: "REPORT_SUBMITTED",
        title: "Báo cáo đã gửi",
        message: `${session.user.displayName} đã gửi báo cáo ngày ${formatCalendarDate(report.reportDate)} của ${report.team.name}.`
      }, true);
      return report;
    });
  }

  async acknowledge(session: AuthenticatedSession, id: string) {
    if (session.user.role !== UserRole.ADMIN) throw new ForbiddenException("Chỉ CEO/Admin được xác nhận báo cáo");
    const current = await this.detail(session, id);
    if (current.status === TeamDailyReportStatus.DRAFT) throw new BadRequestException("Báo cáo chưa được Leader gửi");
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.teamDailyReport.update({
        where: { id },
        data: { status: TeamDailyReportStatus.ACKNOWLEDGED, acknowledgedById: session.user.id, acknowledgedAt: new Date() },
        include: reportInclude
      });
      await this.audit(tx, session.user.id, "TEAM_DAILY_REPORT_ACKNOWLEDGED", id, { teamId: current.teamId });
      await this.notifications.forReport(tx, report, {
        actorUserId: session.user.id,
        eventType: "REPORT_ACKNOWLEDGED",
        title: "Báo cáo đã được xác nhận",
        message: `${session.user.displayName} đã xác nhận báo cáo ngày ${formatCalendarDate(report.reportDate)} của ${report.team.name}.`
      }, true);
      return report;
    });
  }

  async comment(session: AuthenticatedSession, id: string, body: Record<string, unknown>) {
    const report = await this.detail(session, id);
    const message = this.requiredText(body.message, "Nội dung bình luận", 3000);
    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.teamDailyReportComment.create({
        data: { reportId: id, actorUserId: session.user.id, message },
        include: { actor: { select: { id: true, displayName: true, role: true, teamId: true } } }
      });
      await this.audit(tx, session.user.id, "TEAM_DAILY_REPORT_COMMENTED", id, { teamId: report.teamId, commentId: created.id });
      await this.notifications.forReport(tx, report, {
        actorUserId: session.user.id,
        eventType: "REPORT_COMMENTED",
        title: "Có bình luận mới",
        message: `${session.user.displayName} đã bình luận báo cáo ngày ${formatCalendarDate(report.reportDate)} của ${report.team.name}.`
      }, report.status !== TeamDailyReportStatus.DRAFT);
      return created;
    });
    return comment;
  }

  private async editableReport(session: AuthenticatedSession, id: string) {
    const current = await this.prisma.teamDailyReport.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Không tìm thấy báo cáo");
    await this.assertTeamWritable(session, current.teamId);
    if (current.status === TeamDailyReportStatus.ACKNOWLEDGED && session.user.role !== UserRole.ADMIN) {
      throw new BadRequestException("Báo cáo đã được CEO xác nhận");
    }
    return current;
  }

  private async assertTeamVisible(session: AuthenticatedSession, teamId: string) {
    const team = await this.prisma.organizationTeam.findFirst({
      where: { AND: [{ id: teamId, isActive: true }, this.teamScope(session)] },
      include: { department: { select: { code: true, name: true } } }
    });
    if (!team) throw new ForbiddenException("Bạn không có quyền xem báo cáo của team này");
    return team;
  }

  private async assertTeamWritable(session: AuthenticatedSession, teamId: string) {
    if (session.user.role === UserRole.USER) throw new ForbiddenException("Chỉ Leader hoặc CEO/Admin được lập báo cáo");
    return this.assertTeamVisible(session, teamId);
  }

  private teamScope(session: AuthenticatedSession): Prisma.OrganizationTeamWhereInput {
    if (session.user.role === UserRole.ADMIN) return {};
    if (session.user.teamId) return { id: session.user.teamId };
    if (session.user.role === UserRole.MANAGER && session.user.departmentId) return { departmentId: session.user.departmentId };
    return { id: "__no_team__" };
  }

  private reportFields(body: Record<string, unknown>, partial = false): ReportFields | Partial<ReportFields> {
    const fields = ["summary", "completedWork", "inProgressWork", "blockers", "nextPlan"] as const;
    const result: Partial<Record<typeof fields[number], string>> = {};
    for (const field of fields) {
      if (partial && body[field] === undefined) continue;
      result[field] = this.optionalText(body[field], field === "summary" ? 4000 : 10000);
    }
    return result;
  }

  private requiredText(value: unknown, label: string, maxLength: number) {
    if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${label} là bắt buộc`);
    if (value.trim().length > maxLength) throw new BadRequestException(`${label} vượt quá ${maxLength} ký tự`);
    return value.trim();
  }

  private optionalText(value: unknown, maxLength: number) {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") throw new BadRequestException("Nội dung báo cáo không hợp lệ");
    if (value.trim().length > maxLength) throw new BadRequestException(`Nội dung vượt quá ${maxLength} ký tự`);
    return value.trim();
  }

  private audit(tx: Prisma.TransactionClient, actorUserId: string, eventType: string, reportId: string, detail: Prisma.InputJsonValue) {
    return tx.accessAuditEvent.create({ data: { actorUserId, eventType, targetType: "TEAM_DAILY_REPORT", targetId: reportId, detail } });
  }
}

export function parseCalendarDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`${label} không hợp lệ`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatCalendarDate(date) !== value) throw new BadRequestException(`${label} không hợp lệ`);
  return date;
}

function formatCalendarDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function todayInVietnam() {
  return parseCalendarDate(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date()), "Ngày báo cáo");
}

function daysBeforeVietnam(days: number) {
  const date = todayInVietnam();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}
