import { WorkshopDailyMetrics } from "../metrics/workshop-metrics.service";
import { ReportRendererService } from "./report-renderer.service";

const fixture: WorkshopDailyMetrics = {
  meta: {
    specVersion: "0.1",
    reportDate: "2026-10-29",
    timeZone: "Asia/Ho_Chi_Minh",
    windowStartUtc: "2026-10-28 17:00:00Z",
    windowEndUtc: "2026-10-29 17:00:00Z",
    generatedAtUtc: "2026-10-30T07:10:27.198Z"
  },
  source: {},
  sourceFreshness: [],
  intake: {
    orders: 99,
    items: 112,
    quantity: 112,
    methods: [{ method: "embroidery", items: 112, quantity: 112 }],
    orderTypes: [{ orderType: "Shirt", orders: 99 }],
    priorities: [{ priority: "normal", orders: 99 }],
    comparison: {
      previousDayOrders: 105,
      previousDayChangePercent: -5.7,
      previousWeekOrders: 134,
      previousWeekChangePercent: -26.1
    }
  },
  workflow: [
    { stage: "staff", completedOrders: 145, completedItems: 166 },
    { stage: "qc", completedOrders: 165, completedItems: 194 },
    { stage: "packing", completedOrders: 158, completedItems: 160 },
    { stage: "shipout", completedOrders: 158, completedItems: 160 }
  ],
  shipout: { completedOrders: 158, completedItems: 160 },
  backlog: {
    snapshotAtUtc: "2026-10-30T07:10:27.198Z",
    totalOrders: 180,
    byStatus: [
      { status: "confirm", orders: 51, averageAgeHours: 6.2, atLeast72Hours: 0 },
      { status: "pending_stock", orders: 40, averageAgeHours: 188.8, atLeast72Hours: 33 },
      { status: "qc_pass", orders: 32, averageAgeHours: 97.8, atLeast72Hours: 20 }
    ],
    byAgeBand: [
      { ageBand: "<24h", orders: 75 },
      { ageBand: "24-48h", orders: 32 },
      { ageBand: "48-72h", orders: 16 },
      { ageBand: ">=72h", orders: 57 }
    ],
    byPaymentStatus: [
      { paymentStatus: "paid", orders: 151 },
      { paymentStatus: "pending", orders: 29 }
    ]
  },
  events: [],
  remakes: { cases: 0, quantity: 0, cost: 0, byStatus: [] },
  provisionalCosts: {
    totalCost: 2288.1,
    paidCost: 2022.6,
    printCost: 1953.5,
    extraFee: 205.3,
    refundFee: 0,
    embroideryFee: 0,
    noDesignFee: 0,
    priorityFee: 0,
    shippingCost: 129.3
  },
  dataQuality: {
    trackingRows: 0,
    ordersWithCompleteTime: 0,
    softDeletedOrdersInWindow: 0,
    testOrdersInWindow: 0,
    completedWorkflowMissingTime: 0,
    orphanItems: 0,
    orphanProductions: 9
  }
};

describe("ReportRendererService", () => {
  const renderer = new ReportRendererService();

  it("renders the approved deterministic Telegram report", () => {
    const content = renderer.render(fixture);

    expect(content).toContain("BÁO CÁO XƯỞNG LEMIEX — 29/10/2026");
    expect(content).toContain("99 đơn · 112 item · 112 sản phẩm");
    expect(content).toContain("Shipout: 158 đơn / 160 item hoàn tất");
    expect(content).toContain("Backlog hiện có 180 đơn; 57 đơn từ 72 giờ trở lên");
    expect(content).toContain("9 production không ghép được với order_items");
  });

  it("does not publish provisional costs or claim SLA violations", () => {
    const content = renderer.render(fixture);

    expect(content).not.toContain("2.288");
    expect(content).not.toContain("đơn trễ SLA:");
    expect(content).toContain("chưa gắn nhãn trễ SLA");
  });

  it("stays below the Telegram safe limit", () => {
    expect(renderer.render(fixture).length).toBeLessThanOrEqual(
      ReportRendererService.TELEGRAM_SAFE_LIMIT
    );
  });
});
