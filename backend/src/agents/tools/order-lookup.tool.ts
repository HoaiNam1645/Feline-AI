import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { SourceMysqlService } from "../../source/source-mysql.service";
import { SearchEngineService } from "../search/search-engine.service";
import { AgentTool } from "./agent-tool";

interface OrderRow extends RowDataPacket {
  id: number;
  refId: string | null;
  sellerId: number | null;
  seller: string | null;
  tierName: string | null;
  store: string | null;
  orderType: string | null;
  fulfillStatus: string;
  processingStatus: string;
  paymentStatus: string;
  fulfillmentPriority: string;
  totalCost: string | number | null;
  paidCost: string | number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ItemRow extends RowDataPacket {
  orderId: number;
  items: number;
  quantity: string | number;
  methods: string | null;
}

interface WorkflowRow extends RowDataPacket {
  orderId: number;
  stage: string;
  total: number;
  completed: number;
  completedAt: string | null;
}

interface TrackingRow extends RowDataPacket {
  orderId: number;
  trackingId: string | null;
  status: string;
  service: string;
  method: string;
  totalDay: number | null;
  updateTime: string | null;
}

export interface OrderLookupToolOutput {
  identifiers: string[];
  found: boolean;
  orders: Array<{
    id: number;
    refId: string | null;
    matchedBy: Array<"id" | "ref_id" | "tracking">;
    seller: { id: number | null; username: string | null; tierName: string | null; store: string | null };
    orderType: string | null;
    fulfillStatus: string;
    processingStatus: string;
    paymentStatus: string;
    fulfillmentPriority: string;
    items: number;
    quantity: number;
    methods: string[];
    workflow: Array<{ stage: string; total: number; completed: number; completedAt: string | null }>;
    tracking: Array<{ trackingId: string | null; status: string; service: string; method: string; totalDay: number | null; updateTime: string | null }>;
    financials: { totalCost: number; paidCost: number };
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  source: { id: "shop-test"; access: "read-only"; generatedAtUtc: string; dataUpdatedAtUtc: string };
}

@Injectable()
export class OrderLookupTool implements AgentTool<{ question: string }, OrderLookupToolOutput> {
  readonly id = "lemiex.search.orders";
  readonly description = "Tra cứu chính xác đơn hàng theo orders.id, ref_id hoặc tracking cho Admin/Manager.";

  constructor(
    private readonly source: SourceMysqlService,
    private readonly search: SearchEngineService = new SearchEngineService()
  ) {}

  async execute(input: { question: string }): Promise<OrderLookupToolOutput> {
    const analysis = this.search.analyze(input.question);
    const identifiers = analysis.orderIdentifiers;
    const generatedAtUtc = new Date().toISOString();
    if (!identifiers.length) return this.empty(identifiers, generatedAtUtc);
    const placeholders = identifiers.map(() => "?").join(",");
    const orders = await this.source.query<OrderRow>(`
      SELECT DISTINCT o.id, o.ref_id AS refId, o.seller_id AS sellerId,
             s.username AS seller, s.tier_name AS tierName, st.name AS store,
             o.order_type AS orderType, o.fulfill_status AS fulfillStatus,
             o.processing_status AS processingStatus, o.payment_status AS paymentStatus,
             o.fulfillment_priority AS fulfillmentPriority,
             o.total_cost AS totalCost, o.paid_cost AS paidCost,
             o.created_at AS createdAt, o.updated_at AS updatedAt
      FROM orders o
      LEFT JOIN sellers s ON s.seller_id = o.seller_id
      LEFT JOIN stores st ON st.id = o.store_id
      WHERE o.deleted_at IS NULL AND (
        CAST(o.id AS CHAR) IN (${placeholders})
        OR o.ref_id IN (${placeholders})
        OR EXISTS (
          SELECT 1 FROM tracking t
          WHERE t.order_id = o.id AND t.tracking_id IN (${placeholders})
        )
      )
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [...identifiers, ...identifiers, ...identifiers]);
    if (!orders.length) return this.empty(identifiers, generatedAtUtc);
    const orderIds = orders.map((order) => Number(order.id));
    const orderPlaceholders = orderIds.map(() => "?").join(",");
    const [items, workflows, tracking] = await Promise.all([
      this.source.query<ItemRow>(`
        SELECT order_id AS orderId, COUNT(*) AS items, COALESCE(SUM(quantity), 0) AS quantity,
               GROUP_CONCAT(DISTINCT method ORDER BY method SEPARATOR ',') AS methods
        FROM order_items
        WHERE deleted_at IS NULL AND order_id IN (${orderPlaceholders})
        GROUP BY order_id
      `, orderIds),
      this.source.query<WorkflowRow>(`
        SELECT oi.order_id AS orderId, w.stage, COUNT(*) AS total,
               SUM(w.completed = 1) AS completed, MAX(w.completed_at) AS completedAt
        FROM order_item_workflows w
        INNER JOIN order_items oi ON oi.id = w.order_item_id AND oi.deleted_at IS NULL
        WHERE oi.order_id IN (${orderPlaceholders})
        GROUP BY oi.order_id, w.stage
        ORDER BY FIELD(w.stage, 'staff', 'qc', 'packing', 'shipout')
      `, orderIds),
      this.source.query<TrackingRow>(`
        SELECT order_id AS orderId, tracking_id AS trackingId, status, service, method,
               total_day AS totalDay, update_time AS updateTime
        FROM tracking
        WHERE order_id IN (${orderPlaceholders})
        ORDER BY updated_at DESC
      `, orderIds)
    ]);
    const itemByOrder = new Map(items.map((item) => [Number(item.orderId), item]));
    const workflowByOrder = this.groupByOrder(workflows);
    const trackingByOrder = this.groupByOrder(tracking);
    const normalizedIdentifiers = new Set(identifiers.map((value) => value.toLocaleLowerCase("en-US")));
    const outputOrders = orders.map((order) => {
      const id = Number(order.id);
      const item = itemByOrder.get(id);
      const orderTracking = trackingByOrder.get(id) || [];
      const matchedBy: Array<"id" | "ref_id" | "tracking"> = [];
      if (normalizedIdentifiers.has(String(id).toLocaleLowerCase("en-US"))) matchedBy.push("id");
      if (order.refId && normalizedIdentifiers.has(order.refId.toLocaleLowerCase("en-US"))) matchedBy.push("ref_id");
      if (orderTracking.some((row) => row.trackingId && normalizedIdentifiers.has(row.trackingId.toLocaleLowerCase("en-US")))) matchedBy.push("tracking");
      return {
        id,
        refId: order.refId,
        matchedBy,
        seller: { id: order.sellerId === null ? null : Number(order.sellerId), username: order.seller, tierName: order.tierName, store: order.store },
        orderType: order.orderType,
        fulfillStatus: order.fulfillStatus,
        processingStatus: order.processingStatus,
        paymentStatus: order.paymentStatus,
        fulfillmentPriority: order.fulfillmentPriority,
        items: Number(item?.items || 0),
        quantity: Number(item?.quantity || 0),
        methods: item?.methods?.split(",").filter(Boolean) || [],
        workflow: (workflowByOrder.get(id) || []).map((row) => ({ stage: row.stage, total: Number(row.total), completed: Number(row.completed), completedAt: row.completedAt })),
        tracking: orderTracking.map((row) => ({ trackingId: row.trackingId, status: row.status, service: row.service, method: row.method, totalDay: row.totalDay === null ? null : Number(row.totalDay), updateTime: row.updateTime })),
        financials: { totalCost: Number(order.totalCost || 0), paidCost: Number(order.paidCost || 0) },
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    });
    const times = outputOrders.flatMap((order) => [order.updatedAt, ...order.tracking.map((item) => item.updateTime)]).flatMap((value) => {
      if (!value) return [];
      const time = new Date(`${value.replace(" ", "T")}Z`).getTime();
      return Number.isNaN(time) ? [] : [time];
    });
    return {
      identifiers,
      found: true,
      orders: outputOrders,
      source: { id: "shop-test", access: "read-only", generatedAtUtc, dataUpdatedAtUtc: times.length ? new Date(Math.max(...times)).toISOString() : generatedAtUtc }
    };
  }

  private groupByOrder<T extends { orderId: number }>(rows: T[]): Map<number, T[]> {
    const grouped = new Map<number, T[]>();
    for (const row of rows) {
      const id = Number(row.orderId);
      grouped.set(id, [...(grouped.get(id) || []), row]);
    }
    return grouped;
  }

  private empty(identifiers: string[], generatedAtUtc: string): OrderLookupToolOutput {
    return { identifiers, found: false, orders: [], source: { id: "shop-test", access: "read-only", generatedAtUtc, dataUpdatedAtUtc: generatedAtUtc } };
  }
}
