import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2/promise";
import { reportWindow, shiftReportDate } from "../../metrics/report-window";
import { SourceMysqlService } from "../../source/source-mysql.service";
import { AgentTool } from "./agent-tool";

type MetricRow = RowDataPacket & Record<string, string | number | null>;

export interface LivePeriodMetricsToolOutput {
  range: {
    startDate: string;
    endDate: string;
    days: number;
    timeZone: string;
    windowStartUtc: string;
    windowEndUtc: string;
  };
  totals: {
    orders: number;
    items: number;
    quantity: number;
    shipoutOrders: number;
    shipoutItems: number;
    remakeCases: number;
    remakeQuantity: number;
    calculatedFulfillmentFees?: number;
    confirmedFulfillmentRevenue?: number;
  };
  daily: Array<Record<string, string | number | null>>;
  source: {
    id: "shop-test";
    access: "read-only";
    generatedAtUtc: string;
    dataUpdatedAtUtc: string;
  };
}

@Injectable()
export class LivePeriodMetricsTool implements AgentTool<
  { startDate: string; endDate: string; includeFinancials?: boolean },
  LivePeriodMetricsToolOutput
> {
  readonly id = "lemiex.metrics.live-period";
  readonly description = "Tổng hợp metric vận hành theo khoảng ngày bằng truy vấn giới hạn, không nạp nhiều snapshot đầy đủ.";

  constructor(private readonly source: SourceMysqlService) {}

  async execute(input: {
    startDate: string;
    endDate: string;
    includeFinancials?: boolean;
  }): Promise<LivePeriodMetricsToolOutput> {
    const start = reportWindow(input.startDate);
    const end = reportWindow(input.endDate);
    const days = this.daysBetween(input.startDate, input.endDate) + 1;
    if (days < 2 || days > 31) throw new Error("Phạm vi dữ liệu phải từ 2 đến 31 ngày");

    const endExclusive = end.endUtc;
    const [orders, items, shipout, remakes, freshness] = await Promise.all([
      this.source.query<MetricRow>(`
        SELECT DATE(created_at) AS reportDate,
               COUNT(*) AS orders,
               COALESCE(SUM(total_cost), 0) AS fees,
               COALESCE(SUM(paid_cost), 0) AS revenue
        FROM orders
        WHERE created_at >= ? AND created_at < ?
          AND deleted_at IS NULL
          AND fulfill_status NOT IN ('test_order','cancelled','cancelled_refund_shipping','closed')
        GROUP BY DATE(created_at)
        ORDER BY reportDate
      `, [start.startUtc, endExclusive]),
      this.source.query<MetricRow>(`
        SELECT DATE(o.created_at) AS reportDate,
               COUNT(oi.id) AS items,
               COALESCE(SUM(oi.quantity), 0) AS quantity
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
        WHERE o.created_at >= ? AND o.created_at < ?
          AND o.deleted_at IS NULL
          AND o.fulfill_status NOT IN ('test_order','cancelled','cancelled_refund_shipping','closed')
        GROUP BY DATE(o.created_at)
        ORDER BY reportDate
      `, [start.startUtc, endExclusive]),
      this.source.query<MetricRow>(`
        WITH stage_order AS (
          SELECT o.id AS orderId, COUNT(*) AS totalRows,
                 SUM(w.completed = 1) AS completedRows,
                 COUNT(DISTINCT oi.id) AS itemCount,
                 MAX(w.completed_at) AS completedAt
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
          JOIN order_item_workflows w ON w.order_item_id = oi.id AND w.stage = 'shipout'
          WHERE o.deleted_at IS NULL AND o.fulfill_status <> 'test_order'
          GROUP BY o.id
        )
        SELECT DATE(completedAt) AS reportDate,
               COUNT(*) AS shipoutOrders,
               COALESCE(SUM(itemCount), 0) AS shipoutItems
        FROM stage_order
        WHERE totalRows = completedRows AND completedAt >= ? AND completedAt < ?
        GROUP BY DATE(completedAt)
        ORDER BY reportDate
      `, [start.startUtc, endExclusive]),
      this.source.query<MetricRow>(`
        SELECT DATE(created_at) AS reportDate,
               COUNT(*) AS remakeCases,
               COALESCE(SUM(quantity), 0) AS remakeQuantity
        FROM order_item_remakes
        WHERE created_at >= ? AND created_at < ?
        GROUP BY DATE(created_at)
        ORDER BY reportDate
      `, [start.startUtc, endExclusive]),
      this.source.query<MetricRow>(`
        SELECT GREATEST(
          COALESCE((SELECT MAX(updated_at) FROM orders), '1970-01-01'),
          COALESCE((SELECT MAX(updated_at) FROM order_items), '1970-01-01'),
          COALESCE((SELECT MAX(updated_at) FROM order_item_workflows), '1970-01-01'),
          COALESCE((SELECT MAX(updated_at) FROM order_item_remakes), '1970-01-01')
        ) AS dataUpdatedAt
      `)
    ]);

    const byDate = new Map<string, Record<string, string | number | null>>();
    for (let offset = 0; offset < days; offset += 1) {
      const reportDate = shiftReportDate(input.startDate, offset);
      byDate.set(reportDate, {
        reportDate, orders: 0, items: 0, quantity: 0,
        shipoutOrders: 0, shipoutItems: 0, remakeCases: 0, remakeQuantity: 0
      });
    }
    this.mergeRows(byDate, orders, ["orders", "fees", "revenue"]);
    this.mergeRows(byDate, items, ["items", "quantity"]);
    this.mergeRows(byDate, shipout, ["shipoutOrders", "shipoutItems"]);
    this.mergeRows(byDate, remakes, ["remakeCases", "remakeQuantity"]);
    const daily = [...byDate.values()];
    const sum = (key: string) => daily.reduce((total, row) => total + Number(row[key] ?? 0), 0);
    const generatedAtUtc = new Date().toISOString();
    const rawFreshness = String(freshness[0]?.dataUpdatedAt || "");
    const parsedFreshness = new Date(`${rawFreshness.replace(" ", "T")}Z`);

    return {
      range: {
        startDate: input.startDate,
        endDate: input.endDate,
        days,
        timeZone: start.timeZone,
        windowStartUtc: `${start.startUtc}Z`,
        windowEndUtc: `${endExclusive}Z`
      },
      totals: {
        orders: sum("orders"),
        items: sum("items"),
        quantity: sum("quantity"),
        shipoutOrders: sum("shipoutOrders"),
        shipoutItems: sum("shipoutItems"),
        remakeCases: sum("remakeCases"),
        remakeQuantity: sum("remakeQuantity"),
        ...(input.includeFinancials ? {
          calculatedFulfillmentFees: sum("fees"),
          confirmedFulfillmentRevenue: sum("revenue")
        } : {})
      },
      daily: daily.map((row) => input.includeFinancials
        ? row
        : Object.fromEntries(Object.entries(row).filter(([key]) => key !== "fees" && key !== "revenue"))),
      source: {
        id: "shop-test",
        access: "read-only",
        generatedAtUtc,
        dataUpdatedAtUtc: Number.isNaN(parsedFreshness.getTime())
          ? generatedAtUtc
          : parsedFreshness.toISOString()
      }
    };
  }

  private daysBetween(startDate: string, endDate: string): number {
    return Math.round((
      new Date(`${endDate}T00:00:00.000Z`).getTime()
      - new Date(`${startDate}T00:00:00.000Z`).getTime()
    ) / 86_400_000);
  }

  private mergeRows(
    target: Map<string, Record<string, string | number | null>>,
    rows: MetricRow[],
    keys: string[]
  ): void {
    for (const row of rows) {
      const reportDate = String(row.reportDate);
      const current = target.get(reportDate);
      if (!current) continue;
      for (const key of keys) current[key] = Number(row[key] ?? 0);
    }
  }
}
