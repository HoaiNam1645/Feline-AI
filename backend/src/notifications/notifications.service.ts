import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationCategory, Prisma, UserRole, UserStatus } from "@prisma/client";
import { AuthenticatedSession } from "../auth/auth.service";
import { PrismaService } from "../database/prisma.service";

type DbClient = PrismaService | Prisma.TransactionClient;

type TaskNotificationInput = {
  id: string;
  code: string;
  title: string;
  departmentCode: string;
  teamId: string | null;
  createdById: string;
  assigneeId: string | null;
};

type ReportNotificationInput = {
  id: string;
  departmentCode: string;
  teamId: string;
  reportDate: Date;
  status: string;
  createdById: string;
  submittedById?: string | null;
};

type PublishCopy = {
  actorUserId: string;
  eventType: string;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(session: AuthenticatedSession, limitInput?: string) {
    const parsed = Number(limitInput || 30);
    const limit = Number.isInteger(parsed) ? Math.min(50, Math.max(1, parsed)) : 30;
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientUserId: session.user.id },
        include: { actor: { select: { id: true, displayName: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: limit
      }),
      this.prisma.notification.count({ where: { recipientUserId: session.user.id, readAt: null } })
    ]);
    return { items, unread };
  }

  async unreadCount(session: AuthenticatedSession) {
    return { unread: await this.prisma.notification.count({ where: { recipientUserId: session.user.id, readAt: null } }) };
  }

  async markRead(session: AuthenticatedSession, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, recipientUserId: session.user.id, readAt: null },
      data: { readAt: new Date() }
    });
    if (!result.count) {
      const exists = await this.prisma.notification.findFirst({ where: { id, recipientUserId: session.user.id } });
      if (!exists) throw new NotFoundException("Không tìm thấy thông báo");
    }
    return { success: true };
  }

  async markAllRead(session: AuthenticatedSession) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientUserId: session.user.id, readAt: null },
      data: { readAt: new Date() }
    });
    return { success: true, updated: result.count };
  }

  async forTask(client: DbClient, task: TaskNotificationInput, copy: PublishCopy) {
    const recipients = await client.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        id: { not: copy.actorUserId },
        OR: [
          { role: UserRole.ADMIN },
          {
            role: UserRole.MANAGER,
            departmentCode: task.departmentCode,
            ...(task.teamId ? { OR: [{ teamId: task.teamId }, { teamId: null }] } : {})
          },
          task.teamId
            ? { role: UserRole.USER, departmentCode: task.departmentCode, teamId: task.teamId }
            : { role: UserRole.USER, departmentCode: task.departmentCode },
          { id: task.createdById },
          ...(task.assigneeId ? [{ id: task.assigneeId }] : [])
        ]
      },
      select: { id: true }
    });
    return this.createMany(client, recipients.map((item) => item.id), {
      ...copy,
      category: NotificationCategory.TASK,
      entityType: "WORK_TASK",
      entityId: task.id,
      route: `/tasks?task=${encodeURIComponent(task.id)}`,
      metadata: copy.metadata || { code: task.code, departmentCode: task.departmentCode, teamId: task.teamId }
    });
  }

  async forReport(client: DbClient, report: ReportNotificationInput, copy: PublishCopy, includeUsers: boolean) {
    const recipients = await client.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        id: { not: copy.actorUserId },
        OR: [
          { role: UserRole.ADMIN },
          {
            role: UserRole.MANAGER,
            departmentCode: report.departmentCode,
            OR: [{ teamId: report.teamId }, { teamId: null }]
          },
          ...(includeUsers ? [{ role: UserRole.USER, departmentCode: report.departmentCode, teamId: report.teamId }] : []),
          { id: report.createdById },
          ...(report.submittedById ? [{ id: report.submittedById }] : [])
        ]
      },
      select: { id: true }
    });
    const reportDate = report.reportDate.toISOString().slice(0, 10);
    return this.createMany(client, recipients.map((item) => item.id), {
      ...copy,
      category: NotificationCategory.REPORT,
      entityType: "TEAM_DAILY_REPORT",
      entityId: report.id,
      route: `/daily-reports?team=${encodeURIComponent(report.teamId)}&date=${reportDate}&report=${encodeURIComponent(report.id)}`,
      metadata: copy.metadata || { teamId: report.teamId, reportDate, status: report.status }
    });
  }

  private createMany(
    client: DbClient,
    recipientIds: string[],
    input: PublishCopy & { category: NotificationCategory; entityType: string; entityId: string; route: string }
  ) {
    const ids = [...new Set(recipientIds)].filter((id) => id !== input.actorUserId);
    if (!ids.length) return Promise.resolve({ count: 0 });
    return client.notification.createMany({
      data: ids.map((recipientUserId) => ({
        recipientUserId,
        actorUserId: input.actorUserId,
        category: input.category,
        eventType: input.eventType,
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
        route: input.route,
        metadata: input.metadata
      }))
    });
  }
}
