import { expect, test } from "@playwright/test";

const now = "2026-11-19T08:30:00.000Z";
const session = {
  user: { id: "accounting-manager", email: "accounting@feline.com", displayName: "Quản lý Kế toán", departmentCode: "ACCOUNTING", role: "MANAGER", status: "ACTIVE" },
  access: { platformAdmin: false, grants: [{ id: "accounting-grant", agentId: "accounting-ai", capabilityIds: ["accounting.knowledge.ask", "accounting.data.ask"], dataScopeIds: ["accounting.knowledge", "accounting.data.all"], actions: ["view", "run"], expiresAt: null }] }
};

const dashboard = {
  report: { startDate: "2026-11-01", endDate: "2026-11-19", timeZone: "Asia/Ho_Chi_Minh", currency: "VND", generatedAt: now },
  source: { id: "accountant.felineez.com", access: "read-only", dataUpdatedAt: now },
  summary: { income: 485000000, expense: 312000000, netCashFlow: 173000000, transactions: 148, activeAccounts: 7, openReceivables: 4, outstandingReceivables: 96500000 },
  trend: [
    { date: "2026-11-15", income: 72000000, expense: 31000000 },
    { date: "2026-11-16", income: 54000000, expense: 68000000 },
    { date: "2026-11-17", income: 86000000, expense: 42000000 },
    { date: "2026-11-18", income: 91000000, expense: 57000000 },
    { date: "2026-11-19", income: 68000000, expense: 39000000 }
  ],
  categories: [
    { id: "1", name: "Fulfillment", income: 0, expense: 112000000 },
    { id: "2", name: "Doanh thu bán hàng", income: 185000000, expense: 0 },
    { id: "3", name: "Quảng cáo", income: 0, expense: 78000000 },
    { id: "4", name: "Thanh toán đối tác", income: 96000000, expense: 0 }
  ],
  purchaseStatuses: [
    { status: "PENDING_APPROVAL", count: 5, amount: 42000000 },
    { status: "APPROVED", count: 12, amount: 118000000 },
    { status: "PAID", count: 18, amount: 196000000 }
  ],
  conversionStatuses: [],
  recentPurchases: [
    { id: "p1", title: "Thanh toán nguyên liệu thêu", kind: "PURCHASE", expectedAmount: 24500000, currencyCode: "VND", status: "PENDING_APPROVAL", createdAt: now, requester: { fullName: "Nguyễn Văn A" }, category: { name: "Nguyên vật liệu" } },
    { id: "p2", title: "Gia hạn công cụ vận hành", kind: "SERVICE", expectedAmount: 1200, currencyCode: "USD", status: "APPROVED", createdAt: now, requester: { fullName: "Trần Thị B" }, category: { name: "Phần mềm" } }
  ],
  receivables: [
    { id: "r1", title: "Đối soát tháng 10", partyName: "Đối tác A", status: "PARTIAL", dueDate: "2026-11-22T00:00:00.000Z", amountVnd: 85000000, paidVnd: 35000000, outstandingVnd: 50000000 },
    { id: "r2", title: "Công nợ vận chuyển", partyName: "Đối tác B", status: "OPEN", dueDate: "2026-11-25T00:00:00.000Z", amountVnd: 46500000, paidVnd: 0, outstandingVnd: 46500000 }
  ]
};

test("Phòng Kế toán hiển thị đúng dashboard, chat và không tràn màn hình", async ({ page }, testInfo) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: session });
    if (path === "/api/health") return route.fulfill({ json: { status: "ok", timestamp: now } });
    if (path === "/api/accounting/dashboard") return route.fulfill({ json: dashboard });
    if (path === "/api/chat/accounting/conversations") return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });

  await page.goto("/#/agents/accounting/overview");
  await expect(page.getByText("Kế toán AI", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Dòng tiền ròng", { exact: true })).toBeVisible();
  await expect(page.getByText("173.000.000 ₫")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thu và chi theo ngày" })).toBeVisible();
  await expect(page.getByLabel("Chú giải biểu đồ").getByText("Thu", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Chú giải biểu đồ").getByText("Chi", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Yêu cầu mua hàng gần đây" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Công nợ cần theo dõi" })).toBeVisible();
  await expect(page.getByText("Chờ phê duyệt", { exact: true }).first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `../.impeccable/review/accounting-dashboard-${testInfo.project.name}.png`, fullPage: true });

  if (testInfo.project.name === "mobile") await page.locator(".header-menu").click();
  await page.getByRole("button", { name: "Hỏi đáp" }).click();
  await expect(page.getByText("Bạn cần kiểm tra thông tin kế toán nào?", { exact: true })).toBeVisible();
  await expect(page.getByText("Tổng thu chi tháng này là bao nhiêu?", { exact: true })).toBeVisible();
  await page.waitForTimeout(400);

  await page.screenshot({ path: `../.impeccable/review/accounting-chat-${testInfo.project.name}.png`, fullPage: true });
});

test("Kỳ dữ liệu được chọn sau cùng luôn thắng request cũ", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: session });
    if (url.pathname === "/api/health") return route.fulfill({ json: { status: "ok", timestamp: now } });
    if (url.pathname === "/api/accounting/dashboard") {
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const isToday = startDate === endDate;
      const daySpan = startDate && endDate ? (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000 : 0;
      const isWeek = daySpan === 6;
      await new Promise((resolve) => setTimeout(resolve, isToday ? 350 : 30));
      const netCashFlow = isToday ? 111000000 : isWeek ? 222000000 : dashboard.summary.netCashFlow;
      return route.fulfill({ json: { ...dashboard, summary: { ...dashboard.summary, netCashFlow } } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/#/agents/accounting/overview");
  await expect(page.getByText("173.000.000 ₫")).toBeVisible();
  await page.getByRole("button", { name: "Hôm nay" }).click();
  await page.getByRole("button", { name: "7 ngày" }).click();
  await expect(page.getByText("222.000.000 ₫")).toBeVisible();
  await page.waitForTimeout(450);
  await expect(page.getByText("222.000.000 ₫")).toBeVisible();
  await expect(page.getByText("111.000.000 ₫")).toHaveCount(0);
});
