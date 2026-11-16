import { Injectable } from "@nestjs/common";
import { WorkshopDailyMetrics } from "../metrics/workshop-metrics.service";

type DisplayRow = Record<string, string | number | null>;

const STATUS_LABELS: Record<string, string> = {
  confirm: "Confirm",
  pending_stock: "Pending stock",
  qc_pass: "QC pass",
  producing: "Producing",
  new_order: "New order",
  on_hold: "On hold",
  packed: "Packed",
  in_stock: "In stock",
  return_to_support: "Return to support"
};

const STAGE_LABELS: Record<string, string> = {
  staff: "Staff",
  qc: "QC",
  packing: "Packing",
  shipout: "Shipout"
};

@Injectable()
export class ReportRendererService {
  static readonly TEMPLATE_VERSION = "workshop-daily-v0.1";
  static readonly TELEGRAM_SAFE_LIMIT = 3900;

  private readonly numberFormat = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2
  });

  render(metrics: WorkshopDailyMetrics): string {
    const intake = metrics.intake as {
      orders: number;
      items: number;
      quantity: number;
      methods: DisplayRow[];
      orderTypes: DisplayRow[];
      priorities: DisplayRow[];
      comparison: {
        previousDayOrders: number;
        previousDayChangePercent: number | null;
        previousWeekOrders: number;
        previousWeekChangePercent: number | null;
      };
    };
    const backlog = metrics.backlog as {
      snapshotAtUtc: string;
      totalOrders: number;
      byStatus: DisplayRow[];
      byAgeBand: DisplayRow[];
      byPaymentStatus: DisplayRow[];
    };
    const reportDate = metrics.meta.reportDate.split("-").reverse().join("/");
    const warnings = this.dataQualityWarnings(metrics.dataQuality);
    const dataStatus = warnings.length === 0
      ? "Đủ cho KPI vận hành cơ bản"
      : `Đủ cho KPI cơ bản · ${warnings.length} cảnh báo dữ liệu`;

    const lines = [
      `🏭 BÁO CÁO XƯỞNG LEMIEX — ${reportDate}`,
      "Kỳ dữ liệu: 00:00–24:00 giờ Việt Nam",
      `Nguồn: shop-test · Trạng thái: ${dataStatus}`,
      "",
      "1. TIẾP NHẬN",
      `• ${this.n(intake.orders)} đơn · ${this.n(intake.items)} item · ${this.n(intake.quantity)} sản phẩm`,
      this.comparisonLine(
        "So với hôm trước",
        intake.comparison.previousDayOrders,
        intake.comparison.previousDayChangePercent
      ),
      this.comparisonLine(
        "So với cùng thứ tuần trước",
        intake.comparison.previousWeekOrders,
        intake.comparison.previousWeekChangePercent
      ),
      `• Embroidery: ${this.methodQuantity(intake.methods, "embroidery")} · Print: ${this.methodQuantity(intake.methods, "print")}`,
      `• Loại đơn: ${this.joinCounts(intake.orderTypes, "orderType", "orders")}`,
      `• Mức ưu tiên: ${this.joinCounts(intake.priorities, "priority", "orders")}`,
      "",
      "2. HOÀN TẤT CÔNG ĐOẠN",
      ...this.workflowLines(metrics.workflow),
      "",
      "3. BACKLOG TẠI THỜI ĐIỂM SNAPSHOT",
      `• Tổng: ${this.n(backlog.totalOrders)} đơn`,
      ...this.chunkedCounts(backlog.byStatus, "status", "orders", STATUS_LABELS),
      `• Tuổi đơn: ${this.joinCounts(backlog.byAgeBand, "ageBand", "orders")}`,
      `• Thanh toán: ${this.joinCounts(backlog.byPaymentStatus, "paymentStatus", "orders", true)}`,
      "• Tạm thời chỉ hiển thị tuổi backlog, chưa gắn nhãn trễ SLA",
      "",
      "4. LỖI / HỦY / REMAKE",
      `• Sự kiện hủy/refund xác nhận được trong kỳ: ${this.n(this.sum(metrics.events, "events"))}`,
      `• Remake tạo mới: ${this.n(Number(metrics.remakes.cases ?? 0))} case · ${this.n(Number(metrics.remakes.quantity ?? 0))} sản phẩm`,
      "• Công thức refund theo ngày phát sinh vẫn đang chờ xác nhận",
      "",
      "5. NHẬN XÉT TỪ SỐ LIỆU",
      ...this.deterministicObservations(metrics, intake, backlog),
      "",
      "⚠️ CHẤT LƯỢNG DỮ LIỆU",
      ...(warnings.length > 0 ? warnings.map((warning) => `• ${warning}`) : ["• Không phát hiện cảnh báo trong các kiểm tra hiện có"])
    ];

    const content = lines.join("\n");
    if (content.length > ReportRendererService.TELEGRAM_SAFE_LIMIT) {
      throw new Error(
        `Rendered report exceeds Telegram safe limit: ${content.length}`
      );
    }
    return content;
  }

  private n(value: number): string {
    return this.numberFormat.format(value);
  }

  private comparisonLine(
    label: string,
    previousOrders: number,
    changePercent: number | null
  ): string {
    if (changePercent === null) {
      return `• ${label}: ${this.n(previousOrders)} đơn, chưa đủ dữ liệu tính tỷ lệ`;
    }
    const trend = changePercent > 0
      ? `tăng ${this.n(changePercent)}%`
      : changePercent < 0
        ? `giảm ${this.n(Math.abs(changePercent))}%`
        : "không đổi";
    return `• ${label}: ${this.n(previousOrders)} đơn, ${trend}`;
  }

  private methodQuantity(methods: DisplayRow[], method: string): string {
    const row = methods.find((item) => item.method === method);
    return this.n(Number(row?.quantity ?? 0));
  }

  private joinCounts(
    rows: DisplayRow[],
    labelKey: string,
    valueKey: string,
    capitalize = false
  ): string {
    if (rows.length === 0) return "Không có dữ liệu";
    return rows.map((row) => {
      const rawLabel = String(row[labelKey] ?? "unknown");
      const label = capitalize
        ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
        : rawLabel;
      return `${label} ${this.n(Number(row[valueKey] ?? 0))}`;
    }).join(" · ");
  }

  private workflowLines(rows: DisplayRow[]): string[] {
    return ["staff", "qc", "packing", "shipout"].map((stage) => {
      const row = rows.find((item) => item.stage === stage);
      const orders = Number(row?.completedOrders ?? 0);
      const items = Number(row?.completedItems ?? 0);
      const itemSuffix = stage === "shipout" ? ` / ${this.n(items)} item` : "";
      return `• ${STAGE_LABELS[stage]}: ${this.n(orders)} đơn${itemSuffix} hoàn tất`;
    });
  }

  private chunkedCounts(
    rows: DisplayRow[],
    labelKey: string,
    valueKey: string,
    labels: Record<string, string>
  ): string[] {
    const values = rows.map((row) => {
      const key = String(row[labelKey] ?? "unknown");
      return `${labels[key] ?? key} ${this.n(Number(row[valueKey] ?? 0))}`;
    });
    const chunks: string[] = [];
    for (let index = 0; index < values.length; index += 3) {
      chunks.push(`• ${values.slice(index, index + 3).join(" · ")}`);
    }
    return chunks.length > 0 ? chunks : ["• Không có backlog"];
  }

  private sum(rows: DisplayRow[], key: string): number {
    return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  }

  private deterministicObservations(
    metrics: WorkshopDailyMetrics,
    intake: {
      orders: number;
      comparison: {
        previousDayChangePercent: number | null;
        previousWeekChangePercent: number | null;
      };
    },
    backlog: {
      totalOrders: number;
      byStatus: DisplayRow[];
      byAgeBand: DisplayRow[];
    }
  ): string[] {
    const observations: string[] = [];
    const previousDayChange = intake.comparison.previousDayChangePercent;
    const previousWeekChange = intake.comparison.previousWeekChangePercent;
    if (previousDayChange !== null && previousWeekChange !== null) {
      if (previousDayChange < 0 && previousWeekChange < 0) {
        observations.push("• Lượng đơn mới giảm so với cả hôm trước và cùng thứ tuần trước");
      } else if (previousDayChange > 0 && previousWeekChange > 0) {
        observations.push("• Lượng đơn mới tăng so với cả hôm trước và cùng thứ tuần trước");
      } else {
        observations.push("• Biến động đơn mới chưa cùng chiều giữa hai mốc so sánh");
      }
    }

    const shipoutOrders = metrics.shipout.completedOrders;
    const difference = shipoutOrders - intake.orders;
    if (difference > 0) {
      observations.push(
        `• Shipout cao hơn lượng tiếp nhận ${this.n(difference)} đơn trong kỳ`
      );
    } else if (difference < 0) {
      observations.push(
        `• Shipout thấp hơn lượng tiếp nhận ${this.n(Math.abs(difference))} đơn trong kỳ`
      );
    } else {
      observations.push("• Shipout bằng lượng đơn tiếp nhận trong kỳ");
    }

    const oldBacklog = backlog.byAgeBand.find((row) => row.ageBand === ">=72h");
    const oldBacklogCount = Number(oldBacklog?.orders ?? 0);
    observations.push(
      `• Backlog hiện có ${this.n(backlog.totalOrders)} đơn; ${this.n(oldBacklogCount)} đơn từ 72 giờ trở lên`
    );

    const staleStatuses = backlog.byStatus
      .filter((row) => Number(row.atLeast72Hours ?? 0) > 0)
      .sort((a, b) => Number(b.atLeast72Hours) - Number(a.atLeast72Hours))
      .slice(0, 2);
    for (const row of staleStatuses) {
      const key = String(row.status ?? "unknown");
      observations.push(
        `• Cần kiểm tra ${this.n(Number(row.atLeast72Hours))} đơn ${STATUS_LABELS[key] ?? key} đã tồn từ 72 giờ`
      );
    }

    return observations;
  }

  private dataQualityWarnings(quality: Record<string, number>): string[] {
    const warnings: string[] = [];
    if (quality.ordersWithCompleteTime === 0) {
      warnings.push("orders.complete_time đang trống; dùng thời điểm workflow shipout");
    }
    if (quality.trackingRows === 0) {
      warnings.push("Bảng tracking hiện chưa có dữ liệu");
    }
    if (quality.orphanProductions > 0) {
      warnings.push(`${this.n(quality.orphanProductions)} production không ghép được với order_items`);
    }
    if (quality.completedWorkflowMissingTime > 0) {
      warnings.push(`${this.n(quality.completedWorkflowMissingTime)} workflow hoàn tất nhưng thiếu completed_at`);
    }
    return warnings;
  }
}
