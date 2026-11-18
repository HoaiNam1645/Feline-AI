import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole, UserStatus, WorkTaskPriority, WorkTaskStatus } from "@prisma/client";
import { AuthenticatedSession } from "../auth/auth.service";
import { PrismaService } from "../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const ACTIVE_STATUSES: WorkTaskStatus[] = [
  WorkTaskStatus.ASSIGNED,
  WorkTaskStatus.ACCEPTED,
  WorkTaskStatus.IN_PROGRESS,
  WorkTaskStatus.BLOCKED,
  WorkTaskStatus.IN_REVIEW
];
const CLAIMABLE_STATUSES: WorkTaskStatus[] = [WorkTaskStatus.DRAFT, WorkTaskStatus.ASSIGNED];
const RELEASABLE_STATUSES: WorkTaskStatus[] = [WorkTaskStatus.ASSIGNED, WorkTaskStatus.ACCEPTED];
const TASK_LIST_VIEWS = ["ACTIVE", "TODAY", "OVERDUE", "OVER_ESTIMATE", "COMPLETED", "ARCHIVED", "ALL"] as const;
type TaskListView = typeof TASK_LIST_VIEWS[number];
const TASK_DATE_FIELDS = ["createdAt", "dueAt", "startedAt", "completedAt", "updatedAt"] as const;
type TaskDateField = typeof TASK_DATE_FIELDS[number];

const TRANSITIONS: Record<WorkTaskStatus, WorkTaskStatus[]> = {
  DRAFT: [WorkTaskStatus.ASSIGNED, WorkTaskStatus.CANCELED],
  ASSIGNED: [WorkTaskStatus.ACCEPTED, WorkTaskStatus.IN_PROGRESS, WorkTaskStatus.CANCELED],
  ACCEPTED: [WorkTaskStatus.IN_PROGRESS, WorkTaskStatus.BLOCKED, WorkTaskStatus.CANCELED],
  IN_PROGRESS: [WorkTaskStatus.BLOCKED, WorkTaskStatus.IN_REVIEW, WorkTaskStatus.CANCELED],
  BLOCKED: [WorkTaskStatus.IN_PROGRESS, WorkTaskStatus.CANCELED],
  IN_REVIEW: [WorkTaskStatus.COMPLETED, WorkTaskStatus.REJECTED],
  REJECTED: [WorkTaskStatus.IN_PROGRESS, WorkTaskStatus.CANCELED],
  COMPLETED: [],
  CANCELED: []
};

const taskInclude = {
  createdBy: { select: { id: true, displayName: true, email: true } },
  assignee: { select: { id: true, displayName: true, email: true, departmentCode: true, teamId: true, team: { select: { id: true, code: true, name: true } } } },
  team: { select: { id: true, code: true, name: true } },
  checklistItems: {
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
    include: { completedBy: { select: { id: true, displayName: true } } }
  },
  updates: {
    orderBy: { createdAt: "desc" as const },
    include: { actor: { select: { id: true, displayName: true } } }
  },
  timeEntries: {
    orderBy: { startedAt: "desc" as const },
    take: 20,
    include: { actor: { select: { id: true, displayName: true } } }
  }
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async list(session: AuthenticatedSession, filters: { status?: WorkTaskStatus; department?: string; team?: string; assignee?: string; search?: string; view?: string; dateField?: string; from?: string; to?: string }) {
    const view = TASK_LIST_VIEWS.includes(filters.view as TaskListView) ? filters.view as TaskListView : "ACTIVE";
    const conditions: Prisma.WorkTaskWhereInput[] = [this.scopeWhere(session), this.viewWhere(view)];
    if (filters.status && Object.values(WorkTaskStatus).includes(filters.status)) conditions.push({ status: filters.status });
    if (filters.department && session.user.role === UserRole.ADMIN) conditions.push({ departmentCode: filters.department });
    if (filters.team && session.user.role === UserRole.ADMIN) conditions.push({ teamId: filters.team });
    if (filters.assignee) conditions.push({ assigneeId: filters.assignee });
    if (filters.search?.trim()) conditions.push({
      OR: [
        { title: { contains: filters.search.trim(), mode: "insensitive" } },
        { code: { contains: filters.search.trim(), mode: "insensitive" } },
        { assignee: { displayName: { contains: filters.search.trim(), mode: "insensitive" } } }
      ]
    });
    const dateRange = this.dateRangeWhere(filters.dateField, filters.from, filters.to);
    if (dateRange) conditions.push(dateRange);
    const tasks = await this.prisma.workTask.findMany({
      where: { AND: conditions },
      include: {
        createdBy: taskInclude.createdBy,
        assignee: taskInclude.assignee,
        team: taskInclude.team,
        checklistItems: { orderBy: { position: "asc" }, select: { id: true, isCompleted: true } }
      },
      orderBy: view === "COMPLETED" || view === "ARCHIVED"
        ? [{ completedAt: "desc" }, { archivedAt: "desc" }, { createdAt: "desc" }]
        : [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      take: 2000
    });
    return view === "OVER_ESTIMATE" ? tasks.filter((task) => isTaskEstimateExceeded(task)) : tasks;
  }

  async summary(session: AuthenticatedSession, department?: string) {
    const scope: Prisma.WorkTaskWhereInput = {
      AND: [
        this.scopeWhere(session),
        ...(department && session.user.role === UserRole.ADMIN ? [{ departmentCode: department }] : [])
      ]
    };
    const { start, end } = vietnamDayBounds();
    const current = { AND: [scope, { archivedAt: null }] } satisfies Prisma.WorkTaskWhereInput;
    const todayWhere: Prisma.WorkTaskWhereInput = {
      archivedAt: null,
      status: { not: WorkTaskStatus.CANCELED },
      OR: [
        { createdAt: { gte: start, lt: end } },
        { dueAt: { gte: start, lt: end } },
        { completedAt: { gte: start, lt: end } }
      ]
    };
    const activeBoardWhere: Prisma.WorkTaskWhereInput = {
      archivedAt: null,
      status: { not: WorkTaskStatus.CANCELED },
      OR: [
        { status: { not: WorkTaskStatus.COMPLETED } },
        { status: WorkTaskStatus.COMPLETED, completedAt: { gte: start, lt: end } }
      ]
    };
    const [total, active, today, review, completed, completedToday, overdue, archived, byStatus, estimatedTasks] = await Promise.all([
      this.prisma.workTask.count({ where: current }),
      this.prisma.workTask.count({ where: { AND: [scope, activeBoardWhere] } }),
      this.prisma.workTask.count({ where: { AND: [scope, todayWhere] } }),
      this.prisma.workTask.count({ where: { AND: [current, { status: WorkTaskStatus.IN_REVIEW }] } }),
      this.prisma.workTask.count({ where: { AND: [current, { status: WorkTaskStatus.COMPLETED }] } }),
      this.prisma.workTask.count({ where: { AND: [current, { status: WorkTaskStatus.COMPLETED, completedAt: { gte: start, lt: end } }] } }),
      this.prisma.workTask.count({ where: { AND: [current, { dueAt: { lt: new Date() }, status: { in: ACTIVE_STATUSES } }] } }),
      this.prisma.workTask.count({ where: { AND: [scope, { archivedAt: { not: null } }] } }),
      this.prisma.workTask.groupBy({ by: ["status"], where: current, _count: { _all: true } }),
      this.prisma.workTask.findMany({
        where: { AND: [current, { estimatedMinutes: { not: null }, status: { in: ACTIVE_STATUSES } }] },
        select: { estimatedMinutes: true, activeTimeSeconds: true, activeTimerStartedAt: true }
      })
    ]);
    const overEstimate = estimatedTasks.filter((task) => isTaskEstimateExceeded(task)).length;
    return { total, active, today, review, completed, completedToday, overdue, overEstimate, archived, byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) };
  }

  async assignees(session: AuthenticatedSession, department?: string, team?: string) {
    const departmentCode = session.user.role === UserRole.ADMIN ? (department || "TIKTOK") : session.user.departmentCode;
    if (!departmentCode) return [];
    const teamId = session.user.role === UserRole.ADMIN ? team : session.user.teamId;
    return this.prisma.user.findMany({
      where: { departmentCode, ...(teamId ? { teamId } : {}), status: UserStatus.ACTIVE, role: { in: [UserRole.MANAGER, UserRole.USER] } },
      select: { id: true, displayName: true, email: true, role: true, departmentCode: true, teamId: true, team: { select: { id: true, code: true, name: true } } },
      orderBy: { displayName: "asc" }
    });
  }

  async departments(session: AuthenticatedSession) {
    return this.prisma.department.findMany({
      where: {
        isActive: true,
        ...(session.user.role === UserRole.ADMIN ? {} : { code: session.user.departmentCode || "__none__" })
      },
      select: {
        id: true, code: true, name: true, agentId: true,
        teams: { where: { isActive: true }, select: { id: true, code: true, name: true, departmentId: true }, orderBy: { name: "asc" } }
      },
      orderBy: { name: "asc" }
    });
  }

  async detail(session: AuthenticatedSession, id: string) {
    const task = await this.prisma.workTask.findFirst({ where: { id, ...this.scopeWhere(session) }, include: taskInclude });
    if (!task) throw new NotFoundException("Không tìm thấy công việc");
    return task;
  }

  async create(session: AuthenticatedSession, body: Record<string, unknown>) {
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      throw new ForbiddenException("Chỉ Admin hoặc Manager được giao công việc");
    }
    const title = this.requiredText(body.title, "Tên công việc", 160);
    const description = this.requiredText(body.description, "Nội dung công việc", 5000);
    const requestedDepartmentCode = this.requiredText(body.departmentCode || "TIKTOK", "Phòng ban", 50).toUpperCase();
    const departmentCode = session.user.role === UserRole.MANAGER ? session.user.departmentCode : requestedDepartmentCode;
    if (!departmentCode) throw new ForbiddenException("Tài khoản Manager chưa thuộc phòng ban");
    if (session.user.role === UserRole.MANAGER && requestedDepartmentCode !== departmentCode) {
      throw new ForbiddenException("Manager chỉ được giao công việc trong phòng ban của mình");
    }
    const department = await this.prisma.department.findFirst({ where: { code: departmentCode, isActive: true } });
    if (!department) throw new BadRequestException("Phòng ban không tồn tại hoặc đã ngừng hoạt động");
    const requestedTeamId = typeof body.teamId === "string" && body.teamId ? body.teamId : null;
    if (session.user.role === UserRole.MANAGER && session.user.teamId && requestedTeamId && requestedTeamId !== session.user.teamId) {
      throw new ForbiddenException("Manager chỉ được giao công việc trong team của mình");
    }
    const teamId = session.user.role === UserRole.MANAGER && session.user.teamId ? session.user.teamId : requestedTeamId;
    const team = teamId ? await this.prisma.organizationTeam.findFirst({ where: { id: teamId, departmentId: department.id, isActive: true } }) : null;
    if (teamId && !team) throw new BadRequestException("Team không thuộc phòng ban đã chọn");
    const assigneeId = typeof body.assigneeId === "string" && body.assigneeId ? body.assigneeId : null;
    const assignee = assigneeId ? await this.prisma.user.findFirst({
      where: {
        id: assigneeId,
        departmentCode,
        ...(teamId ? { teamId } : {}),
        status: UserStatus.ACTIVE,
        role: { in: [UserRole.MANAGER, UserRole.USER] }
      }
    }) : null;
    if (assigneeId && !assignee) throw new BadRequestException("Người nhận không thuộc phạm vi phòng ban/team được phép giao việc");
    const priority = this.enumValue(WorkTaskPriority, body.priority, WorkTaskPriority.NORMAL);
    const dueAt = this.optionalDate(body.dueAt);
    if (!dueAt) throw new BadRequestException("Cần đặt ngày giờ hoàn thành dự kiến");
    const estimatedMinutes = body.estimatedMinutes === undefined ? null : this.optionalEstimateMinutes(body.estimatedMinutes);
    const checklist = this.checklistTitles(body.checklist);
    const status = assigneeId ? WorkTaskStatus.ASSIGNED : WorkTaskStatus.DRAFT;
    const code = await this.nextCode();
    return this.prisma.$transaction(async (tx) => {
      const position = await this.nextPosition(tx, departmentCode, status);
      const task = await tx.workTask.create({
        data: {
          code, title, description, departmentCode, departmentName: department.name, teamId,
          agentId: department.agentId || (typeof body.agentId === "string" ? body.agentId : null),
          priority, status, position, dueAt, estimatedMinutes, createdById: session.user.id, assigneeId,
          checklistItems: checklist.length ? { create: checklist.map((item, position) => ({ title: item, position })) } : undefined
        },
        include: taskInclude
      });
      await tx.workTaskUpdate.create({ data: { taskId: task.id, actorUserId: session.user.id, type: "CREATED", toStatus: status, message: assignee ? `Đã giao cho ${assignee.displayName}` : "Đã tạo bản nháp" } });
      await this.audit(tx, session.user.id, "TASK_CREATED", task.id, { code, departmentCode, teamId, assigneeId, status });
      await this.notifications.forTask(tx, task, {
        actorUserId: session.user.id,
        eventType: "TASK_CREATED",
        title: "Công việc mới",
        message: `${session.user.displayName} đã tạo ${task.code}: ${task.title}.`
      });
      return task;
    });
  }

  async reorder(session: AuthenticatedSession, body: Record<string, unknown>) {
    const status = this.enumValue(WorkTaskStatus, body.status);
    if (!Array.isArray(body.taskIds) || body.taskIds.length > 500 || body.taskIds.some((id) => typeof id !== "string")) {
      throw new BadRequestException("Danh sách sắp xếp không hợp lệ");
    }
    const taskIds = [...new Set(body.taskIds as string[])];
    if (!taskIds.length) return { success: true };
    const visible = await this.prisma.workTask.findMany({
      where: { AND: [this.scopeWhere(session), { id: { in: taskIds }, status, archivedAt: null }] },
      select: { id: true }
    });
    if (visible.length !== taskIds.length) throw new ForbiddenException("Bạn không có quyền sắp xếp một hoặc nhiều công việc");
    await this.prisma.$transaction(taskIds.map((id, position) => this.prisma.workTask.update({ where: { id }, data: { position } })));
    return { success: true };
  }

  async update(session: AuthenticatedSession, id: string, body: Record<string, unknown>) {
    const current = await this.detail(session, id);
    if (current.archivedAt) throw new BadRequestException("Công việc đang được lưu trữ. Hãy khôi phục trước khi cập nhật");
    const requestedStatus = body.status ? this.enumValue(WorkTaskStatus, body.status) : undefined;
    const progress = body.progressPercent === undefined ? undefined : this.progress(body.progressPercent);
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : undefined;
    const isAdmin = session.user.role === UserRole.ADMIN;
    const canEditDetails = isAdmin || session.user.role === UserRole.MANAGER;
    const detailFields = ["title", "description", "priority", "dueAt", "teamId", "assigneeId"];
    const wantsDetailEdit = detailFields.some((field) => body[field] !== undefined);
    const wantsEstimateEdit = body.estimatedMinutes !== undefined;
    const detailEditableStatuses: WorkTaskStatus[] = [WorkTaskStatus.DRAFT, WorkTaskStatus.ASSIGNED, WorkTaskStatus.ACCEPTED];
    if (wantsDetailEdit && !canEditDetails) throw new ForbiddenException("Bạn không có quyền chỉnh sửa công việc");
    if (wantsDetailEdit && !detailEditableStatuses.includes(current.status)) {
      throw new BadRequestException("Chỉ được chỉnh sửa khi công việc Chưa giao hoặc Cần làm");
    }
    if (wantsEstimateEdit) {
      const canEstimate = isAdmin || session.user.role === UserRole.MANAGER || current.assigneeId === session.user.id;
      if (!canEstimate) throw new ForbiddenException("Chỉ người nhận hoặc quản lý được đặt thời gian dự kiến");
      if (this.taskEnded(current.status)) throw new BadRequestException("Công việc đã kết thúc, không thể đổi thời gian dự kiến");
    }
    if (progress !== undefined && current.checklistItems.length > 0) {
      throw new BadRequestException("Tiến độ được tính tự động theo checklist");
    }
    if (requestedStatus && !isAdmin && !TRANSITIONS[current.status].includes(requestedStatus)) throw new BadRequestException("Không thể chuyển sang trạng thái này");
    const adminOnlyStatuses: WorkTaskStatus[] = [WorkTaskStatus.COMPLETED, WorkTaskStatus.REJECTED, WorkTaskStatus.CANCELED];
    if (requestedStatus && adminOnlyStatuses.includes(requestedStatus) && !isAdmin) {
      throw new ForbiddenException("Trạng thái này cần CEO/Admin xác nhận");
    }
    if (requestedStatus === WorkTaskStatus.BLOCKED && !message) throw new BadRequestException("Cần ghi rõ lý do đang bị chặn");
    const statusesWithoutAssignee: WorkTaskStatus[] = [WorkTaskStatus.DRAFT, WorkTaskStatus.CANCELED];
    if (requestedStatus && !statusesWithoutAssignee.includes(requestedStatus) && !current.assigneeId) {
      throw new BadRequestException("Cần chỉ định người nhận trước khi chuyển trạng thái");
    }
    const data: Prisma.WorkTaskUpdateInput = {};
    let transitionNow: Date | undefined;
    if (requestedStatus) {
      const now = new Date();
      transitionNow = now;
      data.status = requestedStatus;
      if (requestedStatus !== current.status) {
        data.position = await this.nextPosition(this.prisma, current.departmentCode, requestedStatus);
      }
      if (current.status === WorkTaskStatus.IN_PROGRESS && requestedStatus !== WorkTaskStatus.IN_PROGRESS && current.activeTimerStartedAt) {
        data.activeTimeSeconds = { increment: elapsedSeconds(current.activeTimerStartedAt, now) };
        data.activeTimerStartedAt = null;
      }
      if (requestedStatus === WorkTaskStatus.IN_PROGRESS && current.status !== WorkTaskStatus.IN_PROGRESS) {
        if (!current.startedAt) data.startedAt = now;
        data.activeTimerStartedAt = now;
        data.blockedReason = null;
      }
      if (requestedStatus === WorkTaskStatus.IN_REVIEW) data.submittedAt = now;
      if (requestedStatus === WorkTaskStatus.COMPLETED) { data.completedAt = now; data.progressPercent = 100; }
      if (current.status === WorkTaskStatus.COMPLETED && requestedStatus !== WorkTaskStatus.COMPLETED) data.completedAt = null;
      if (current.status === WorkTaskStatus.IN_REVIEW && requestedStatus !== WorkTaskStatus.COMPLETED) data.submittedAt = null;
      if (requestedStatus === WorkTaskStatus.BLOCKED) data.blockedReason = message;
      if (requestedStatus === WorkTaskStatus.REJECTED) data.completionNote = message;
      if (requestedStatus === WorkTaskStatus.CANCELED) {
        data.archivedAt = now;
        data.archivedById = session.user.id;
      }
    }
    if (progress !== undefined && requestedStatus !== WorkTaskStatus.COMPLETED) data.progressPercent = progress;
    if (wantsEstimateEdit) data.estimatedMinutes = this.optionalEstimateMinutes(body.estimatedMinutes);
    let automaticStatus: WorkTaskStatus | undefined;
    if (canEditDetails && wantsDetailEdit) {
      if (typeof body.title === "string") data.title = this.requiredText(body.title, "Tên công việc", 160);
      if (typeof body.description === "string") data.description = this.requiredText(body.description, "Nội dung công việc", 5000);
      if (body.priority) data.priority = this.enumValue(WorkTaskPriority, body.priority);
      if (body.dueAt !== undefined) data.dueAt = this.optionalDate(body.dueAt);

      let targetTeamId = current.teamId;
      if (body.teamId !== undefined) {
        if (typeof body.teamId !== "string") throw new BadRequestException("Team không hợp lệ");
        targetTeamId = body.teamId || null;
        if (session.user.role === UserRole.MANAGER && session.user.teamId && targetTeamId !== session.user.teamId) {
          throw new ForbiddenException("Manager chỉ được cập nhật công việc trong team của mình");
        }
        if (targetTeamId) {
          const team = await this.prisma.organizationTeam.findFirst({
            where: { id: targetTeamId, department: { code: current.departmentCode }, isActive: true }
          });
          if (!team) throw new BadRequestException("Team không thuộc phòng ban của công việc");
          data.team = { connect: { id: team.id } };
        } else {
          data.team = { disconnect: true };
        }
      }

      if (typeof body.assigneeId === "string") {
        if (body.assigneeId) {
          const managerTeamId = session.user.role === UserRole.MANAGER ? session.user.teamId : null;
          const assigneeTeamId = targetTeamId || managerTeamId;
          const assignee = await this.prisma.user.findFirst({
            where: {
              id: body.assigneeId,
              departmentCode: current.departmentCode,
              ...(assigneeTeamId ? { teamId: assigneeTeamId } : {}),
              status: UserStatus.ACTIVE,
              role: { in: [UserRole.MANAGER, UserRole.USER] }
            }
          });
          if (!assignee) throw new BadRequestException("Người nhận không thuộc phòng ban/team của công việc");
          if (!targetTeamId && managerTeamId) {
            targetTeamId = managerTeamId;
            data.team = { connect: { id: managerTeamId } };
          }
          data.assignee = { connect: { id: assignee.id } };
          if (!requestedStatus && current.status === WorkTaskStatus.DRAFT) automaticStatus = WorkTaskStatus.ASSIGNED;
        } else {
          data.assignee = { disconnect: true };
          if (!requestedStatus && (current.status === WorkTaskStatus.ASSIGNED || current.status === WorkTaskStatus.ACCEPTED)) automaticStatus = WorkTaskStatus.DRAFT;
        }
      } else if (body.teamId !== undefined && current.assignee && current.assignee.teamId !== targetTeamId) {
        data.assignee = { disconnect: true };
        if (!requestedStatus) automaticStatus = WorkTaskStatus.DRAFT;
      }
      if (automaticStatus) {
        data.status = automaticStatus;
        if (automaticStatus !== current.status) {
          data.position = await this.nextPosition(this.prisma, current.departmentCode, automaticStatus);
        }
      }
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.workTask.update({ where: { id }, data });
      if (requestedStatus === WorkTaskStatus.IN_PROGRESS && current.status !== WorkTaskStatus.IN_PROGRESS && transitionNow) {
        const openEntry = await tx.workTaskTimeEntry.findFirst({ where: { taskId: id, endedAt: null }, orderBy: { startedAt: "desc" } });
        if (!openEntry) {
          await tx.workTaskTimeEntry.create({ data: { taskId: id, actorUserId: session.user.id, startedAt: transitionNow } });
        }
      }
      if (current.status === WorkTaskStatus.IN_PROGRESS && requestedStatus && requestedStatus !== WorkTaskStatus.IN_PROGRESS && transitionNow) {
        const openEntries = await tx.workTaskTimeEntry.findMany({ where: { taskId: id, endedAt: null } });
        await Promise.all(openEntries.map((entry) => tx.workTaskTimeEntry.update({
          where: { id: entry.id },
          data: { endedAt: transitionNow, durationSeconds: elapsedSeconds(entry.startedAt, transitionNow) }
        })));
      }
      if (requestedStatus === WorkTaskStatus.COMPLETED && current.checklistItems.length > 0) {
        await tx.workTaskChecklistItem.updateMany({
          where: { taskId: id, isCompleted: false },
          data: { isCompleted: true, completedAt: new Date(), completedById: session.user.id }
        });
      }
      const resultingStatus = requestedStatus || automaticStatus;
      await tx.workTaskUpdate.create({ data: { taskId: id, actorUserId: session.user.id, type: resultingStatus ? "STATUS_CHANGED" : wantsEstimateEdit ? "ESTIMATE_UPDATED" : "UPDATED", message: message || (wantsEstimateEdit ? `Thời gian dự kiến: ${this.optionalEstimateMinutes(body.estimatedMinutes) || 0} phút` : wantsDetailEdit ? "Đã cập nhật công việc và thông tin giao việc" : undefined), fromStatus: resultingStatus ? current.status : undefined, toStatus: resultingStatus, progressPercent: progress } });
      await this.audit(tx, session.user.id, "TASK_UPDATED", id, { requestedStatus, automaticStatus, progress, wantsDetailEdit, wantsEstimateEdit });
      const task = await tx.workTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
      await this.notifications.forTask(tx, task, {
        actorUserId: session.user.id,
        eventType: resultingStatus ? "TASK_STATUS_CHANGED" : "TASK_UPDATED",
        title: resultingStatus ? "Thay đổi trạng thái công việc" : "Công việc được cập nhật",
        message: resultingStatus
          ? `${session.user.displayName} đã chuyển ${task.code}: ${task.title} sang ${taskStatusLabel(resultingStatus)}.`
          : `${session.user.displayName} đã cập nhật ${task.code}: ${task.title}.`
      });
      return task;
    });
  }

  async archive(session: AuthenticatedSession, id: string) {
    const task = await this.detail(session, id);
    this.ensureTaskManager(session);
    if (task.archivedAt) return task;
    if (!this.taskEnded(task.status)) {
      throw new BadRequestException("Chỉ có thể lưu trữ công việc đã hoàn thành hoặc đã hủy");
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.workTask.update({ where: { id }, data: { archivedAt: new Date(), archivedById: session.user.id } });
      await tx.workTaskUpdate.create({ data: { taskId: id, actorUserId: session.user.id, type: "ARCHIVED", message: "Đã đưa công việc vào lưu trữ" } });
      await this.audit(tx, session.user.id, "TASK_ARCHIVED", id, { previousStatus: task.status });
      const updated = await tx.workTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
      await this.notifications.forTask(tx, updated, {
        actorUserId: session.user.id,
        eventType: "TASK_ARCHIVED",
        title: "Công việc được lưu trữ",
        message: `${session.user.displayName} đã lưu trữ ${updated.code}: ${updated.title}.`
      });
      return updated;
    });
  }

  async restore(session: AuthenticatedSession, id: string) {
    const task = await this.detail(session, id);
    this.ensureTaskManager(session);
    if (!task.archivedAt) return task;
    return this.prisma.$transaction(async (tx) => {
      const restoredStatus = task.status === WorkTaskStatus.CANCELED
        ? task.assigneeId ? WorkTaskStatus.ASSIGNED : WorkTaskStatus.DRAFT
        : task.status;
      const position = await this.nextPosition(tx, task.departmentCode, restoredStatus);
      await tx.workTask.update({ where: { id }, data: { archivedAt: null, archivedById: null, status: restoredStatus, position } });
      await tx.workTaskUpdate.create({ data: { taskId: id, actorUserId: session.user.id, type: "RESTORED", message: "Đã khôi phục công việc khỏi lưu trữ" } });
      await this.audit(tx, session.user.id, "TASK_RESTORED", id, { previousStatus: task.status, restoredStatus });
      const updated = await tx.workTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
      await this.notifications.forTask(tx, updated, {
        actorUserId: session.user.id,
        eventType: "TASK_RESTORED",
        title: "Công việc được khôi phục",
        message: `${session.user.displayName} đã khôi phục ${updated.code}: ${updated.title}.`
      });
      return updated;
    });
  }

  async claim(session: AuthenticatedSession, id: string) {
    if (!session.user.departmentCode) throw new ForbiddenException("Tài khoản chưa thuộc phòng ban");
    const task = await this.prisma.workTask.findFirst({ where: { id, ...this.claimableWhere(session) }, include: taskInclude });
    if (!task) throw new NotFoundException("Công việc không còn khả dụng để nhận");
    if (task.assigneeId === session.user.id) return task;
    if (task.assigneeId) throw new BadRequestException("Công việc đã có người phụ trách");
    if (!CLAIMABLE_STATUSES.includes(task.status)) {
      throw new BadRequestException("Chỉ có thể nhận công việc đang chờ tiếp nhận");
    }
    return this.prisma.$transaction(async (tx) => {
      const position = task.status === WorkTaskStatus.ASSIGNED
        ? task.position
        : await this.nextPosition(tx, task.departmentCode, WorkTaskStatus.ASSIGNED);
      const claimResult = await tx.workTask.updateMany({
        where: {
          AND: [
            this.claimableWhere(session),
            { id, assigneeId: null, archivedAt: null, status: { in: CLAIMABLE_STATUSES } }
          ]
        },
        data: { assigneeId: session.user.id, status: WorkTaskStatus.ASSIGNED, position }
      });
      if (claimResult.count !== 1) throw new BadRequestException("Công việc vừa được thành viên khác tiếp nhận");
      await tx.workTaskUpdate.create({ data: { taskId: id, actorUserId: session.user.id, type: "CLAIMED", fromStatus: task.status, toStatus: WorkTaskStatus.ASSIGNED, message: `${session.user.displayName} đã nhận phụ trách` } });
      await this.audit(tx, session.user.id, "TASK_CLAIMED", id, { previousStatus: task.status });
      const updated = await tx.workTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
      await this.notifications.forTask(tx, updated, {
        actorUserId: session.user.id,
        eventType: "TASK_CLAIMED",
        title: "Công việc đã được nhận",
        message: `${session.user.displayName} đã nhận ${updated.code}: ${updated.title}.`
      });
      return updated;
    });
  }

  async release(session: AuthenticatedSession, id: string) {
    const task = await this.detail(session, id);
    const canRelease = session.user.role === UserRole.ADMIN || session.user.role === UserRole.MANAGER || task.assigneeId === session.user.id;
    if (!canRelease) throw new ForbiddenException("Bạn không có quyền trả lại công việc");
    if (!RELEASABLE_STATUSES.includes(task.status) || task.startedAt) {
      throw new BadRequestException("Chỉ có thể trả lại công việc trước khi bắt đầu làm");
    }
    return this.prisma.$transaction(async (tx) => {
      const position = await this.nextPosition(tx, task.departmentCode, WorkTaskStatus.DRAFT);
      await tx.workTask.update({ where: { id }, data: { assigneeId: null, status: WorkTaskStatus.DRAFT, position } });
      await tx.workTaskUpdate.create({ data: { taskId: id, actorUserId: session.user.id, type: "RELEASED", fromStatus: task.status, toStatus: WorkTaskStatus.DRAFT, message: "Đã trả công việc về danh sách chờ tiếp nhận" } });
      await this.audit(tx, session.user.id, "TASK_RELEASED", id, { previousAssigneeId: task.assigneeId });
      const updated = await tx.workTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
      await this.notifications.forTask(tx, updated, {
        actorUserId: session.user.id,
        eventType: "TASK_RELEASED",
        title: "Công việc được trả lại",
        message: `${session.user.displayName} đã trả ${updated.code}: ${updated.title} về danh sách chờ.`
      });
      return updated;
    });
  }

  async addUpdate(session: AuthenticatedSession, id: string, body: Record<string, unknown>) {
    const task = await this.detail(session, id);
    const message = this.requiredText(body.message, "Nội dung cập nhật", 2000);
    const progress = body.progressPercent === undefined ? undefined : this.progress(body.progressPercent);
    if (progress !== undefined && task.checklistItems.length > 0) {
      throw new BadRequestException("Tiến độ được tính tự động theo checklist");
    }
    return this.prisma.$transaction(async (tx) => {
      if (progress !== undefined) await tx.workTask.update({ where: { id }, data: { progressPercent: progress } });
      const update = await tx.workTaskUpdate.create({ data: { taskId: id, actorUserId: session.user.id, type: "PROGRESS_UPDATE", message, progressPercent: progress }, include: { actor: { select: { id: true, displayName: true } } } });
      await this.audit(tx, session.user.id, "TASK_PROGRESS_UPDATED", id, { progress });
      await this.notifications.forTask(tx, task, {
        actorUserId: session.user.id,
        eventType: "TASK_PROGRESS_UPDATED",
        title: "Có cập nhật mới",
        message: `${session.user.displayName} đã cập nhật ${task.code}: ${task.title}.`
      });
      return update;
    });
  }

  async addChecklistItem(session: AuthenticatedSession, id: string, body: Record<string, unknown>) {
    const task = await this.detail(session, id);
    this.ensureChecklistManager(session);
    if (this.taskEnded(task.status)) {
      throw new BadRequestException("Không thể sửa checklist của công việc đã kết thúc");
    }
    if (task.checklistItems.length >= 50) throw new BadRequestException("Checklist tối đa 50 mục");
    const title = this.requiredText(body.title, "Nội dung checklist", 240);
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.workTaskChecklistItem.aggregate({ where: { taskId: id }, _max: { position: true } });
      await tx.workTaskChecklistItem.create({ data: { taskId: id, title, position: (last._max.position ?? -1) + 1 } });
      const progress = await this.syncChecklistProgress(tx, id);
      await tx.workTaskUpdate.create({ data: { taskId: id, actorUserId: session.user.id, type: "CHECKLIST_ITEM_ADDED", message: `Đã thêm checklist: ${title}`, progressPercent: progress } });
      await this.audit(tx, session.user.id, "TASK_CHECKLIST_ITEM_ADDED", id, { title, progress });
      const updated = await tx.workTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
      await this.notifications.forTask(tx, updated, {
        actorUserId: session.user.id,
        eventType: "TASK_CHECKLIST_UPDATED",
        title: "Checklist được cập nhật",
        message: `${session.user.displayName} đã thêm một mục vào ${updated.code}: ${updated.title}.`
      });
      return updated;
    });
  }

  async updateChecklistItem(session: AuthenticatedSession, id: string, itemId: string, body: Record<string, unknown>) {
    const task = await this.detail(session, id);
    const item = task.checklistItems.find((entry) => entry.id === itemId);
    if (!item) throw new NotFoundException("Không tìm thấy mục checklist");
    if (this.taskEnded(task.status)) {
      throw new BadRequestException("Không thể sửa checklist của công việc đã kết thúc");
    }
    const hasCompleted = typeof body.isCompleted === "boolean";
    const hasTitle = typeof body.title === "string";
    if (!hasCompleted && !hasTitle) throw new BadRequestException("Không có thay đổi checklist");
    if (hasTitle) this.ensureChecklistManager(session);
    const title = hasTitle ? this.requiredText(body.title, "Nội dung checklist", 240) : item.title;
    const isCompleted = hasCompleted ? body.isCompleted as boolean : item.isCompleted;
    return this.prisma.$transaction(async (tx) => {
      await tx.workTaskChecklistItem.update({
        where: { id: itemId },
        data: {
          ...(hasTitle ? { title } : {}),
          ...(hasCompleted ? {
            isCompleted,
            completedAt: isCompleted ? new Date() : null,
            completedById: isCompleted ? session.user.id : null
          } : {})
        }
      });
      const progress = await this.syncChecklistProgress(tx, id);
      const message = hasCompleted
        ? `${isCompleted ? "Đã hoàn thành" : "Đã mở lại"}: ${title}`
        : `Đã sửa checklist: ${title}`;
      await tx.workTaskUpdate.create({ data: { taskId: id, actorUserId: session.user.id, type: "CHECKLIST_ITEM_UPDATED", message, progressPercent: progress } });
      await this.audit(tx, session.user.id, "TASK_CHECKLIST_ITEM_UPDATED", id, { itemId, isCompleted, progress });
      const updated = await tx.workTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
      await this.notifications.forTask(tx, updated, {
        actorUserId: session.user.id,
        eventType: "TASK_CHECKLIST_UPDATED",
        title: "Checklist được cập nhật",
        message: `${session.user.displayName} đã cập nhật checklist của ${updated.code}: ${updated.title}.`
      });
      return updated;
    });
  }

  async removeChecklistItem(session: AuthenticatedSession, id: string, itemId: string) {
    const task = await this.detail(session, id);
    this.ensureChecklistManager(session);
    const item = task.checklistItems.find((entry) => entry.id === itemId);
    if (!item) throw new NotFoundException("Không tìm thấy mục checklist");
    if (this.taskEnded(task.status)) {
      throw new BadRequestException("Không thể sửa checklist của công việc đã kết thúc");
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.workTaskChecklistItem.delete({ where: { id: itemId } });
      const progress = await this.syncChecklistProgress(tx, id);
      await tx.workTaskUpdate.create({ data: { taskId: id, actorUserId: session.user.id, type: "CHECKLIST_ITEM_REMOVED", message: `Đã xóa checklist: ${item.title}`, progressPercent: progress } });
      await this.audit(tx, session.user.id, "TASK_CHECKLIST_ITEM_REMOVED", id, { itemId, progress });
      const updated = await tx.workTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
      await this.notifications.forTask(tx, updated, {
        actorUserId: session.user.id,
        eventType: "TASK_CHECKLIST_UPDATED",
        title: "Checklist được cập nhật",
        message: `${session.user.displayName} đã xóa một mục khỏi ${updated.code}: ${updated.title}.`
      });
      return updated;
    });
  }

  private scopeWhere(session: AuthenticatedSession): Prisma.WorkTaskWhereInput {
    if (session.user.role === UserRole.ADMIN) return {};
    if (session.user.role === UserRole.MANAGER && session.user.teamId) {
      return { departmentCode: session.user.departmentCode || "__none__", OR: [{ teamId: session.user.teamId }, { teamId: null }] };
    }
    if (session.user.role === UserRole.MANAGER && session.user.departmentCode) return { departmentCode: session.user.departmentCode };
    if (session.user.departmentCode) {
      const availableUnassignedScopes: Prisma.WorkTaskWhereInput[] = [
        { assigneeId: null, teamId: null }
      ];
      if (session.user.teamId) {
        availableUnassignedScopes.unshift({ assigneeId: null, teamId: session.user.teamId });
      }
      return {
        departmentCode: session.user.departmentCode,
        OR: [
          { assigneeId: session.user.id },
          ...availableUnassignedScopes
        ]
      };
    }
    return { assigneeId: session.user.id };
  }

  private claimableWhere(session: AuthenticatedSession): Prisma.WorkTaskWhereInput {
    if (session.user.role === UserRole.ADMIN) return { archivedAt: null };
    const availableScopes: Prisma.WorkTaskWhereInput[] = [
      { assigneeId: session.user.id },
      { assigneeId: null, teamId: null }
    ];
    if (session.user.teamId) {
      availableScopes.splice(1, 0, { assigneeId: null, teamId: session.user.teamId });
    }
    return {
      archivedAt: null,
      departmentCode: session.user.departmentCode || "__none__",
      OR: availableScopes
    };
  }

  private viewWhere(view: TaskListView): Prisma.WorkTaskWhereInput {
    const { start, end } = vietnamDayBounds();
    if (view === "ARCHIVED") return { archivedAt: { not: null } };
    if (view === "COMPLETED") return { archivedAt: null, status: WorkTaskStatus.COMPLETED };
    if (view === "OVERDUE") return { archivedAt: null, dueAt: { lt: new Date() }, status: { in: ACTIVE_STATUSES } };
    if (view === "OVER_ESTIMATE") return { archivedAt: null, estimatedMinutes: { not: null }, status: { in: ACTIVE_STATUSES } };
    if (view === "TODAY") return {
      archivedAt: null,
      status: { not: WorkTaskStatus.CANCELED },
      OR: [
        { createdAt: { gte: start, lt: end } },
        { dueAt: { gte: start, lt: end } },
        { completedAt: { gte: start, lt: end } }
      ]
    };
    if (view === "ALL") return { archivedAt: null, status: { not: WorkTaskStatus.CANCELED } };
    return {
      archivedAt: null,
      status: { not: WorkTaskStatus.CANCELED },
      OR: [
        { status: { not: WorkTaskStatus.COMPLETED } },
        { status: WorkTaskStatus.COMPLETED, completedAt: { gte: start, lt: end } }
      ]
    };
  }

  private requiredText(value: unknown, label: string, max: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) throw new BadRequestException(`${label} không được để trống`);
    if (text.length > max) throw new BadRequestException(`${label} tối đa ${max} ký tự`);
    return text;
  }

  private dateRangeWhere(dateFieldInput?: string, fromInput?: string, toInput?: string): Prisma.WorkTaskWhereInput | null {
    if (!fromInput && !toInput) return null;
    const dateField = TASK_DATE_FIELDS.includes(dateFieldInput as TaskDateField) ? dateFieldInput as TaskDateField : "createdAt";
    return { [dateField]: vietnamDateRange(fromInput, toInput) } as Prisma.WorkTaskWhereInput;
  }

  private optionalDate(value: unknown) {
    if (value === null || value === "" || value === undefined) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Thời hạn không hợp lệ");
    return date;
  }

  private enumValue<T extends Record<string, string>>(values: T, value: unknown, fallback?: T[keyof T]): T[keyof T] {
    if (value === undefined && fallback) return fallback;
    if (typeof value !== "string" || !Object.values(values).includes(value)) throw new BadRequestException("Giá trị không hợp lệ");
    return value as T[keyof T];
  }

  private progress(value: unknown) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 100) throw new BadRequestException("Tiến độ phải từ 0 đến 100");
    return number;
  }

  private optionalEstimateMinutes(value: unknown) {
    if (value === null || value === "") return null;
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 525_600) {
      throw new BadRequestException("Thời gian dự kiến phải từ 5 phút đến 1 năm");
    }
    return minutes;
  }

  private checklistTitles(value: unknown) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new BadRequestException("Checklist không hợp lệ");
    if (value.length > 50) throw new BadRequestException("Checklist tối đa 50 mục");
    return value.map((item) => this.requiredText(item, "Nội dung checklist", 240));
  }

  private ensureChecklistManager(session: AuthenticatedSession) {
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      throw new ForbiddenException("Chỉ Admin hoặc Manager được thay đổi cấu trúc checklist");
    }
  }

  private ensureTaskManager(session: AuthenticatedSession) {
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      throw new ForbiddenException("Chỉ Admin hoặc Manager được quản lý lưu trữ công việc");
    }
  }

  private taskEnded(status: WorkTaskStatus) {
    return status === WorkTaskStatus.COMPLETED || status === WorkTaskStatus.CANCELED;
  }

  private async syncChecklistProgress(tx: Prisma.TransactionClient, taskId: string) {
    const [total, completed] = await Promise.all([
      tx.workTaskChecklistItem.count({ where: { taskId } }),
      tx.workTaskChecklistItem.count({ where: { taskId, isCompleted: true } })
    ]);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    await tx.workTask.update({ where: { id: taskId }, data: { progressPercent: progress } });
    return progress;
  }

  private async nextCode() {
    const prefix = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "2-digit", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "");
    const count = await this.prisma.workTask.count({ where: { code: { startsWith: `TASK-${prefix}` } } });
    return `TASK-${prefix}-${String(count + 1).padStart(3, "0")}`;
  }

  private async nextPosition(client: PrismaService | Prisma.TransactionClient, departmentCode: string, status: WorkTaskStatus) {
    const last = await client.workTask.aggregate({ where: { departmentCode, status, archivedAt: null }, _max: { position: true } });
    return (last._max.position ?? -1) + 1;
  }

  private audit(tx: Prisma.TransactionClient, actorUserId: string, eventType: string, taskId: string, detail: Prisma.InputJsonValue) {
    return tx.accessAuditEvent.create({ data: { actorUserId, eventType, targetType: "WORK_TASK", targetId: taskId, detail } });
  }
}

export function elapsedSeconds(startedAt: Date | string, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));
}

export function taskWorkedSeconds(task: { activeTimeSeconds: number; activeTimerStartedAt: Date | string | null }, now = new Date()): number {
  return task.activeTimeSeconds + (task.activeTimerStartedAt ? elapsedSeconds(task.activeTimerStartedAt, now) : 0);
}

export function isTaskEstimateExceeded(task: { estimatedMinutes: number | null; activeTimeSeconds: number; activeTimerStartedAt: Date | string | null }, now = new Date()): boolean {
  return task.estimatedMinutes !== null && taskWorkedSeconds(task, now) > task.estimatedMinutes * 60;
}

function taskStatusLabel(status: WorkTaskStatus) {
  const labels: Record<WorkTaskStatus, string> = {
    DRAFT: "Chưa giao",
    ASSIGNED: "Cần làm",
    ACCEPTED: "Đã nhận",
    IN_PROGRESS: "Đang thực hiện",
    BLOCKED: "Đang bị chặn",
    IN_REVIEW: "Chờ duyệt",
    REJECTED: "Cần làm lại",
    COMPLETED: "Hoàn thành",
    CANCELED: "Đã hủy"
  };
  return labels[status];
}

export function vietnamDateRange(fromInput?: string, toInput?: string): { gte?: Date; lt?: Date } {
  const validDate = (value?: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const normalized = new Date(Date.UTC(year, month - 1, day));
    return normalized.getUTCFullYear() === year && normalized.getUTCMonth() === month - 1 && normalized.getUTCDate() === day;
  };
  if (fromInput && !validDate(fromInput)) throw new BadRequestException("Ngày bắt đầu không hợp lệ");
  if (toInput && !validDate(toInput)) throw new BadRequestException("Ngày kết thúc không hợp lệ");
  const from = fromInput ? new Date(`${fromInput}T00:00:00+07:00`) : undefined;
  const to = toInput ? new Date(new Date(`${toInput}T00:00:00+07:00`).getTime() + 86_400_000) : undefined;
  if (from && to && from >= to) throw new BadRequestException("Khoảng thời gian không hợp lệ");
  return { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
}

export function vietnamDayBounds(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const start = new Date(`${date}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}
