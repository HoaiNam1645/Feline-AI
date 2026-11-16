import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2/promise";
import { SourceMysqlService } from "../source/source-mysql.service";
import { reportWindow, shiftReportDate } from "./report-window";

type DbValue = string | number | null;
type MetricRow = RowDataPacket & Record<string, DbValue>;

function numeric(value: DbValue | undefined): number {
  return Number(value ?? 0);
}

function rowsWithNumbers(rows: MetricRow[], numericKeys: string[]) {
  return rows.map((row) => {
    const output: Record<string, string | number | null> = { ...row };
    for (const key of numericKeys) output[key] = numeric(row[key]);
    return output;
  });
}

export interface WorkshopDailyMetrics {
  meta: {
    specVersion: string;
    reportDate: string;
    timeZone: string;
    windowStartUtc: string;
    windowEndUtc: string;
    generatedAtUtc: string;
  };
  source: Record<string, string>;
  sourceFreshness: Array<Record<string, string | number | null>>;
  intake: Record<string, unknown>;
  workflow: Array<Record<string, string | number | null>>;
  shipout: Record<string, number>;
  backlog: Record<string, unknown>;
  events: Array<Record<string, string | number | null>>;
  remakes: Record<string, unknown>;
  provisionalCosts: Record<string, number>;
  management?: {
    financials: Record<string, number>;
    dailyTrend: Array<Record<string, string | number | null>>;
    sellerRanking: Array<Record<string, string | number | null>>;
  };
  dataQuality: Record<string, number>;
}

@Injectable()
export class WorkshopMetricsService {
  static readonly SPEC_VERSION = "0.1";

  constructor(private readonly source: SourceMysqlService) {}

  async calculateDaily(reportDate: string, includeManagement = false): Promise<WorkshopDailyMetrics> {
    const window = reportWindow(reportDate);
    const previousWindow = reportWindow(shiftReportDate(reportDate, -1));
    const previousWeekWindow = reportWindow(shiftReportDate(reportDate, -7));
    const commonFilters = `
      o.created_at >= ? AND o.created_at < ?
      AND o.deleted_at IS NULL
      AND o.fulfill_status <> 'test_order'
    `;

    const [
      sourceInfo,
      freshness,
      orderTotals,
      itemTotals,
      methods,
      orderTypes,
      priorities,
      comparisons,
      workflow,
      backlogStatus,
      backlogAge,
      backlogPayment,
      events,
      remakes,
      remakeStatuses,
      costs,
      quality
    ] = await Promise.all([
      this.source.connectionInfo(),
      this.source.query<MetricRow>(`
        SELECT 'orders' AS sourceTable, COUNT(*) AS rowCount, MAX(updated_at) AS maxUpdatedAt FROM orders
        UNION ALL SELECT 'order_items', COUNT(*), MAX(updated_at) FROM order_items
        UNION ALL SELECT 'productions', COUNT(*), MAX(updated_at) FROM productions
        UNION ALL SELECT 'order_item_workflows', COUNT(*), MAX(updated_at) FROM order_item_workflows
        UNION ALL SELECT 'order_item_remakes', COUNT(*), MAX(updated_at) FROM order_item_remakes
        UNION ALL SELECT 'tracking', COUNT(*), MAX(updated_at) FROM tracking
        UNION ALL SELECT 'stores', COUNT(*), MAX(updated_at) FROM stores
        UNION ALL SELECT 'timeline', COUNT(*), MAX(updated_at) FROM timeline
      `),
      this.source.query<MetricRow>(`
        SELECT COUNT(*) AS orders
        FROM orders o
        WHERE ${commonFilters}
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT COUNT(oi.id) AS items, COALESCE(SUM(oi.quantity), 0) AS quantity
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
        WHERE ${commonFilters}
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT oi.method, COUNT(oi.id) AS items, COALESCE(SUM(oi.quantity), 0) AS quantity
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
        WHERE ${commonFilters}
        GROUP BY oi.method
        ORDER BY oi.method
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT COALESCE(o.order_type, 'unknown') AS orderType, COUNT(*) AS orders
        FROM orders o
        WHERE ${commonFilters}
        GROUP BY o.order_type
        ORDER BY orders DESC
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT o.fulfillment_priority AS priority, COUNT(*) AS orders
        FROM orders o
        WHERE ${commonFilters}
        GROUP BY o.fulfillment_priority
        ORDER BY orders DESC
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT
          SUM(CASE WHEN o.created_at >= ? AND o.created_at < ? THEN 1 ELSE 0 END) AS currentOrders,
          SUM(CASE WHEN o.created_at >= ? AND o.created_at < ? THEN 1 ELSE 0 END) AS previousDayOrders,
          SUM(CASE WHEN o.created_at >= ? AND o.created_at < ? THEN 1 ELSE 0 END) AS previousWeekOrders
        FROM orders o
        WHERE o.created_at >= ? AND o.created_at < ?
          AND o.deleted_at IS NULL
          AND o.fulfill_status <> 'test_order'
      `, [
        window.startUtc,
        window.endUtc,
        previousWindow.startUtc,
        previousWindow.endUtc,
        previousWeekWindow.startUtc,
        previousWeekWindow.endUtc,
        previousWeekWindow.startUtc,
        window.endUtc
      ]),
      this.source.query<MetricRow>(`
        WITH stage_order AS (
          SELECT w.stage, o.id AS orderId,
                 COUNT(*) AS totalRows,
                 SUM(w.completed = 1) AS completedRows,
                 COUNT(DISTINCT oi.id) AS itemCount,
                 MAX(w.completed_at) AS completedAt
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
          JOIN order_item_workflows w ON w.order_item_id = oi.id
          WHERE o.deleted_at IS NULL AND o.fulfill_status <> 'test_order'
          GROUP BY w.stage, o.id
        )
        SELECT stage, COUNT(*) AS completedOrders, SUM(itemCount) AS completedItems
        FROM stage_order
        WHERE totalRows = completedRows
          AND completedAt >= ? AND completedAt < ?
        GROUP BY stage
        ORDER BY FIELD(stage, 'staff', 'qc', 'packing', 'shipout')
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT fulfill_status AS status, COUNT(*) AS orders,
               ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, UTC_TIMESTAMP())), 1) AS averageAgeHours,
               SUM(TIMESTAMPDIFF(HOUR, created_at, UTC_TIMESTAMP()) >= 72) AS atLeast72Hours
        FROM orders
        WHERE deleted_at IS NULL
          AND fulfill_status NOT IN ('shipped','cancelled','cancelled_refund_shipping','closed','test_order')
        GROUP BY fulfill_status
        ORDER BY orders DESC
      `),
      this.source.query<MetricRow>(`
        SELECT CASE
          WHEN TIMESTAMPDIFF(HOUR, created_at, UTC_TIMESTAMP()) < 24 THEN '<24h'
          WHEN TIMESTAMPDIFF(HOUR, created_at, UTC_TIMESTAMP()) < 48 THEN '24-48h'
          WHEN TIMESTAMPDIFF(HOUR, created_at, UTC_TIMESTAMP()) < 72 THEN '48-72h'
          ELSE '>=72h'
        END AS ageBand, COUNT(*) AS orders
        FROM orders
        WHERE deleted_at IS NULL
          AND fulfill_status NOT IN ('shipped','cancelled','cancelled_refund_shipping','closed','test_order')
        GROUP BY ageBand
        ORDER BY FIELD(ageBand, '<24h', '24-48h', '48-72h', '>=72h')
      `),
      this.source.query<MetricRow>(`
        SELECT payment_status AS paymentStatus, COUNT(*) AS orders
        FROM orders
        WHERE deleted_at IS NULL
          AND fulfill_status NOT IN ('shipped','cancelled','cancelled_refund_shipping','closed','test_order')
        GROUP BY payment_status
        ORDER BY orders DESC
      `),
      this.source.query<MetricRow>(`
        SELECT action, COUNT(*) AS events, COUNT(DISTINCT object_id) AS orders
        FROM timeline
        WHERE object = 'order' AND created_at >= ? AND created_at < ?
          AND action IN ('cancelled order','closed order','refund_label','edit_refund')
        GROUP BY action
        ORDER BY action
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT COUNT(*) AS cases, COALESCE(SUM(quantity), 0) AS quantity,
               COALESCE(SUM(price), 0) AS cost
        FROM order_item_remakes
        WHERE created_at >= ? AND created_at < ?
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT status, COUNT(*) AS cases, COALESCE(SUM(quantity), 0) AS quantity,
               COALESCE(SUM(price), 0) AS cost
        FROM order_item_remakes
        WHERE created_at >= ? AND created_at < ?
        GROUP BY status
        ORDER BY status
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT COALESCE(SUM(total_cost), 0) AS totalCost,
               COALESCE(SUM(paid_cost), 0) AS paidCost,
               COALESCE(SUM(print_cost), 0) AS printCost,
               COALESCE(SUM(extra_fee), 0) AS extraFee,
               COALESCE(SUM(refund_fee), 0) AS refundFee,
               COALESCE(SUM(embroidery_fee), 0) AS embroideryFee,
               COALESCE(SUM(no_design_fee), 0) AS noDesignFee,
               COALESCE(SUM(priority_fee), 0) AS priorityFee,
               COALESCE(SUM(shipping_cost), 0) AS shippingCost
        FROM orders o
        WHERE ${commonFilters}
          AND o.fulfill_status NOT IN ('cancelled','cancelled_refund_shipping','closed')
      `, [window.startUtc, window.endUtc]),
      this.source.query<MetricRow>(`
        SELECT
          (SELECT COUNT(*) FROM tracking) AS trackingRows,
          (SELECT COUNT(*) FROM orders WHERE complete_time IS NOT NULL) AS ordersWithCompleteTime,
          (SELECT COUNT(*) FROM orders o WHERE o.created_at >= ? AND o.created_at < ? AND o.deleted_at IS NOT NULL) AS softDeletedOrdersInWindow,
          (SELECT COUNT(*) FROM orders o WHERE o.created_at >= ? AND o.created_at < ? AND o.fulfill_status = 'test_order') AS testOrdersInWindow,
          (SELECT COUNT(*) FROM order_item_workflows WHERE completed = 1 AND completed_at IS NULL) AS completedWorkflowMissingTime,
          (SELECT COUNT(*) FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL) AS orphanItems,
          (SELECT COUNT(*) FROM productions p LEFT JOIN order_items oi ON oi.id = p.order_item_id WHERE oi.id IS NULL) AS orphanProductions
      `, [window.startUtc, window.endUtc, window.startUtc, window.endUtc])
    ]);

    const workflowRows = rowsWithNumbers(workflow, [
      "completedOrders",
      "completedItems"
    ]);
    const shipoutRow = workflowRows.find((row) => row.stage === "shipout");
    const currentOrders = numeric(comparisons[0]?.currentOrders);
    const previousDayOrders = numeric(comparisons[0]?.previousDayOrders);
    const previousWeekOrders = numeric(comparisons[0]?.previousWeekOrders);
    const percentageChange = (current: number, previous: number) =>
      previous === 0 ? null : Number((((current - previous) / previous) * 100).toFixed(1));

    const financials = {
      totalCost: numeric(costs[0]?.totalCost),
      paidCost: numeric(costs[0]?.paidCost),
      printCost: numeric(costs[0]?.printCost),
      extraFee: numeric(costs[0]?.extraFee),
      refundFee: numeric(costs[0]?.refundFee),
      embroideryFee: numeric(costs[0]?.embroideryFee),
      noDesignFee: numeric(costs[0]?.noDesignFee),
      priorityFee: numeric(costs[0]?.priorityFee),
      shippingCost: numeric(costs[0]?.shippingCost)
    };
    let management: WorkshopDailyMetrics["management"];
    if (includeManagement) {
      const trendWindow = reportWindow(shiftReportDate(reportDate, -6));
      const [dailyTrend, sellerRanking] = await Promise.all([
        this.source.query<MetricRow>(`
          SELECT DATE(DATE_ADD(o.created_at, INTERVAL 7 HOUR)) AS reportDate,
                 COUNT(*) AS orders,
                 COALESCE(SUM(o.paid_cost), 0) AS revenue,
                 COALESCE(SUM(o.total_cost), 0) AS fees
          FROM orders o
          WHERE o.created_at >= ? AND o.created_at < ?
            AND o.deleted_at IS NULL
            AND o.fulfill_status NOT IN ('test_order','cancelled','cancelled_refund_shipping','closed')
          GROUP BY DATE(DATE_ADD(o.created_at, INTERVAL 7 HOUR))
          ORDER BY reportDate
        `, [trendWindow.startUtc, window.endUtc]),
        this.source.query<MetricRow>(`
          SELECT o.seller_id AS sellerId,
                 CONCAT('Seller #', COALESCE(o.seller_id, 'N/A')) AS seller,
                 COALESCE(GROUP_CONCAT(DISTINCT NULLIF(s.name, '') ORDER BY s.name SEPARATOR ', '), 'Không rõ store') AS stores,
                 COUNT(*) AS orders,
                 COALESCE(SUM(items.itemCount), 0) AS items,
                 COALESCE(SUM(items.quantity), 0) AS quantity,
                 COALESCE(SUM(o.paid_cost), 0) AS revenue,
                 COALESCE(SUM(o.total_cost), 0) AS fees
          FROM orders o
          LEFT JOIN stores s ON s.id = o.store_id
          LEFT JOIN (
            SELECT order_id, COUNT(*) AS itemCount, COALESCE(SUM(quantity), 0) AS quantity
            FROM order_items
            WHERE deleted_at IS NULL
            GROUP BY order_id
          ) items ON items.order_id = o.id
          WHERE ${commonFilters}
            AND o.fulfill_status NOT IN ('cancelled','cancelled_refund_shipping','closed')
          GROUP BY o.seller_id
          ORDER BY revenue DESC, orders DESC
          LIMIT 10
        `, [window.startUtc, window.endUtc])
      ]);
      management = {
        financials,
        dailyTrend: rowsWithNumbers(dailyTrend, ["orders", "revenue", "fees"]),
        sellerRanking: rowsWithNumbers(sellerRanking, ["sellerId", "orders", "items", "quantity", "revenue", "fees"])
      };
    }

    return {
      meta: {
        specVersion: WorkshopMetricsService.SPEC_VERSION,
        reportDate,
        timeZone: window.timeZone,
        windowStartUtc: `${window.startUtc}Z`,
        windowEndUtc: `${window.endUtc}Z`,
        generatedAtUtc: new Date().toISOString()
      },
      source: sourceInfo,
      sourceFreshness: rowsWithNumbers(freshness, ["rowCount"]),
      intake: {
        orders: numeric(orderTotals[0]?.orders),
        items: numeric(itemTotals[0]?.items),
        quantity: numeric(itemTotals[0]?.quantity),
        methods: rowsWithNumbers(methods, ["items", "quantity"]),
        orderTypes: rowsWithNumbers(orderTypes, ["orders"]),
        priorities: rowsWithNumbers(priorities, ["orders"]),
        comparison: {
          previousDayOrders,
          previousDayChangePercent: percentageChange(currentOrders, previousDayOrders),
          previousWeekOrders,
          previousWeekChangePercent: percentageChange(currentOrders, previousWeekOrders)
        }
      },
      workflow: workflowRows,
      shipout: {
        completedOrders: numeric(shipoutRow?.completedOrders as DbValue),
        completedItems: numeric(shipoutRow?.completedItems as DbValue)
      },
      backlog: {
        snapshotAtUtc: new Date().toISOString(),
        totalOrders: backlogStatus.reduce(
          (sum, row) => sum + numeric(row.orders),
          0
        ),
        byStatus: rowsWithNumbers(backlogStatus, [
          "orders",
          "averageAgeHours",
          "atLeast72Hours"
        ]),
        byAgeBand: rowsWithNumbers(backlogAge, ["orders"]),
        byPaymentStatus: rowsWithNumbers(backlogPayment, ["orders"])
      },
      events: rowsWithNumbers(events, ["events", "orders"]),
      remakes: {
        cases: numeric(remakes[0]?.cases),
        quantity: numeric(remakes[0]?.quantity),
        cost: numeric(remakes[0]?.cost),
        byStatus: rowsWithNumbers(remakeStatuses, ["cases", "quantity", "cost"])
      },
      provisionalCosts: financials,
      ...(management ? { management } : {}),
      dataQuality: {
        trackingRows: numeric(quality[0]?.trackingRows),
        ordersWithCompleteTime: numeric(quality[0]?.ordersWithCompleteTime),
        softDeletedOrdersInWindow: numeric(quality[0]?.softDeletedOrdersInWindow),
        testOrdersInWindow: numeric(quality[0]?.testOrdersInWindow),
        completedWorkflowMissingTime: numeric(quality[0]?.completedWorkflowMissingTime),
        orphanItems: numeric(quality[0]?.orphanItems),
        orphanProductions: numeric(quality[0]?.orphanProductions)
      }
    };
  }
}
