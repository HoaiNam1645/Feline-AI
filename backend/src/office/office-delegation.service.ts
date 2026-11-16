import {
  BadRequestException,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { AgentRunStatus, Prisma, UserRole } from "@prisma/client";
import { hasAgentAccess } from "../auth/access-control";
import { AuthenticatedSession } from "../auth/auth.service";
import { PrismaService } from "../database/prisma.service";
import { WorkshopMetricsService } from "../metrics/workshop-metrics.service";

export type OfficeDelegationStage =
  | "AUTHORIZED"
  | "DISPATCHED"
  | "PROCESSING"
  | "RESULT_READY"
  | "COMPLETED";

export interface OfficeDelegationResult {
  runId: string;
  question: string;
  route: { fromAgentId: "ceo-ai"; toAgentId: "lemiex-ai"; capabilityId: string };
  reportDate: string;
  answerMarkdown: string;
  metric: {
    id: "orders";
    label: string;
    value: number;
    unit: string;
    previousDayChangePercent: number | null;
  };
  source: {
    id: "shop-test";
    access: "read-only";
    generatedAtUtc: string;
    dataUpdatedAtUtc: string;
    timeZone: string;
  };
}

const CAPABILITY_ID = "ceo.delegate.lemiex.orders";

@Injectable()
export class OfficeDelegationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: WorkshopMetricsService
  ) {}

  async delegate(
    session: AuthenticatedSession,
    body: Record<string, unknown>,
    emitStage: (stage: OfficeDelegationStage, message: string) => void
  ): Promise<OfficeDelegationResult> {
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 500) {
      throw new BadRequestException("Câu hỏi phải có từ 1 đến 500 ký tự");
    }
    if (!this.isOrderCountQuestion(question)) {
      throw new BadRequestException(
        "Tuyến liên công ty hiện hỗ trợ câu hỏi về số đơn Lemiex theo ngày."
      );
    }

    await this.assertLemiexAccess(session, question);
    await this.assertNoConcurrentDelegation(session.user.id);
    const reportDate = this.resolveReportDate(question, body.reportDate);
    emitStage("AUTHORIZED", "Đã xác nhận quyền truy cập dữ liệu Lemiex.");

    const run = await this.prisma.agentRun.create({
      data: {
        agentId: "ceo-ai",
        capabilityId: CAPABILITY_ID,
        status: AgentRunStatus.RUNNING,
        actorUserId: session.user.id,
        input: {
          question,
          reportDate,
          fromAgentId: "ceo-ai",
          toAgentId: "lemiex-ai"
        }
      }
    });

    await this.audit(session.user.id, "OFFICE_DELEGATION_DISPATCHED", run.id, {
      question,
      reportDate,
      fromAgentId: "ceo-ai",
      toAgentId: "lemiex-ai"
    });

    try {
      emitStage("DISPATCHED", "Đang chuyển yêu cầu từ Feline sang Lemiex.");
      emitStage("PROCESSING", "Lemiex AI đang đọc dữ liệu xưởng được cấp quyền.");
      const managementAccess = session.user.role === UserRole.ADMIN
        || session.user.role === UserRole.MANAGER;
      const metrics = await this.metrics.calculateDaily(reportDate, managementAccess);
      const orders = Number(metrics.intake.orders || 0);
      const change = this.numberOrNull(metrics.intake.comparison);
      const dataUpdatedAtUtc = this.latestFreshness(
        metrics.sourceFreshness,
        metrics.meta.generatedAtUtc
      );
      const answerMarkdown = [
        `## Lemiex có ${orders.toLocaleString("vi-VN")} đơn`,
        "",
        `Số liệu được tính cho ngày **${this.displayDate(reportDate)}** theo múi giờ Việt Nam.`,
        change === null
          ? "Chưa đủ dữ liệu để so sánh với ngày trước đó."
          : `So với ngày trước: **${change > 0 ? "+" : ""}${change}%**.`,
        "",
        `*Dữ liệu đến thời điểm ${this.displayTimestamp(dataUpdatedAtUtc)}.*`
      ].join("\n");
      const result: OfficeDelegationResult = {
        runId: run.id,
        question,
        route: {
          fromAgentId: "ceo-ai",
          toAgentId: "lemiex-ai",
          capabilityId: CAPABILITY_ID
        },
        reportDate,
        answerMarkdown,
        metric: {
          id: "orders",
          label: "Đơn tiếp nhận",
          value: orders,
          unit: "đơn",
          previousDayChangePercent: change
        },
        source: {
          id: "shop-test",
          access: "read-only",
          generatedAtUtc: metrics.meta.generatedAtUtc,
          dataUpdatedAtUtc,
          timeZone: metrics.meta.timeZone
        }
      };

      emitStage("RESULT_READY", "Lemiex AI đã hoàn tất báo cáo và bàn giao kết quả.");
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.COMPLETED,
          output: result as unknown as Prisma.InputJsonValue,
          promptVersion: "office-delegation-v1",
          inputTokens: 0,
          outputTokens: 0,
          completedAt: new Date()
        }
      });
      await this.audit(session.user.id, "OFFICE_DELEGATION_COMPLETED", run.id, {
        reportDate,
        metric: result.metric,
        source: result.source
      });
      emitStage("COMPLETED", "Kết quả đã được chuyển về Phòng Giám đốc Feline.");
      return result;
    } catch (error) {
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.FAILED,
          error: error instanceof Error ? error.message.slice(0, 1000) : "Không thể hoàn tất yêu cầu",
          completedAt: new Date()
        }
      });
      await this.audit(session.user.id, "OFFICE_DELEGATION_FAILED", run.id, {
        reportDate,
        error: error instanceof Error ? error.message.slice(0, 1000) : "unknown_error"
      });
      throw error;
    }
  }

  private async assertLemiexAccess(session: AuthenticatedSession, question: string) {
    const allowed = hasAgentAccess(session.access, {
      agentId: "lemiex-ai",
      action: "view",
      dataScopeIds: ["lemiex.operations.basic"]
    });
    if (allowed) return;
    await this.audit(session.user.id, "OFFICE_DELEGATION_DENIED", null, {
      question,
      reason: "missing_lemiex_data_access"
    });
    throw new ForbiddenException("Bạn chưa được cấp quyền xem dữ liệu vận hành Lemiex");
  }

  private async assertNoConcurrentDelegation(userId: string) {
    const active = await this.prisma.agentRun.findFirst({
      where: {
        actorUserId: userId,
        capabilityId: CAPABILITY_ID,
        status: AgentRunStatus.RUNNING,
        createdAt: { gte: new Date(Date.now() - 2 * 60_000) }
      },
      select: { id: true }
    });
    if (active) {
      throw new BadRequestException("Một yêu cầu liên công ty đang được xử lý. Vui lòng chờ hoàn tất.");
    }
  }

  private isOrderCountQuestion(question: string) {
    const normalized = question.toLocaleLowerCase("vi-VN");
    return /(?:bao\s*nhiêu|số\s*(?:lượng\s*)?|tổng\s*)?(?:đơn|orders?)/i.test(normalized)
      && /lemiex|xưởng|hôm nay|hôm qua|ngày/i.test(normalized);
  }

  private resolveReportDate(question: string, input: unknown) {
    if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    const iso = question.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    const vietnamese = question.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
    if (vietnamese) {
      return `${vietnamese[3]}-${vietnamese[2].padStart(2, "0")}-${vietnamese[1].padStart(2, "0")}`;
    }
    const today = this.todayInVietnam();
    if (/hôm\s*qua/i.test(question)) {
      const date = new Date(`${today}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() - 1);
      return date.toISOString().slice(0, 10);
    }
    return today;
  }

  private todayInVietnam() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  private numberOrNull(comparison: unknown) {
    if (!comparison || typeof comparison !== "object") return null;
    const value = (comparison as Record<string, unknown>).previousDayChangePercent;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private latestFreshness(rows: Array<Record<string, string | number | null>>, fallback: string) {
    const times = rows.flatMap((row) => {
      if (typeof row.maxUpdatedAt !== "string" || !row.maxUpdatedAt) return [];
      const value = new Date(`${row.maxUpdatedAt.replace(" ", "T")}Z`).getTime();
      return Number.isNaN(value) ? [] : [value];
    });
    return times.length ? new Date(Math.max(...times)).toISOString() : fallback;
  }

  private displayDate(value: string) {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(`${value}T00:00:00.000Z`));
  }

  private displayTimestamp(value: string) {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh"
    }).format(new Date(value));
  }

  private audit(
    actorUserId: string,
    eventType: string,
    targetId: string | null,
    detail: Record<string, unknown>
  ) {
    return this.prisma.accessAuditEvent.create({
      data: {
        actorUserId,
        eventType,
        targetType: "AgentDelegation",
        targetId,
        detail: detail as Prisma.InputJsonValue
      }
    });
  }
}
