import { expect, test } from "@playwright/test";

const session = {
  user: {
    id: "lemiex-user",
    email: "lemiex@example.com",
    displayName: "Nhân sự Lemiex",
    departmentCode: "LEMIEX",
    role: "USER",
    status: "ACTIVE"
  },
  access: {
    platformAdmin: false,
    grants: [{
      id: "lemiex-grant",
      agentId: "lemiex-ai",
      capabilityIds: ["lemiex.operations.daily-review", "lemiex.operations.ask"],
      dataScopeIds: ["lemiex.operations.basic"],
      actions: ["view", "run", "export"],
      expiresAt: null
    }]
  }
};

test("tài khoản Lemiex chỉ thấy không gian và chức năng Lemiex", async ({ page }, testInfo) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: session });
    if (path === "/api/health") return route.fulfill({ json: { status: "ok", timestamp: new Date().toISOString() } });
    if (path === "/api/agents/lemiex") return route.fulfill({ json: {
      id: "lemiex-ai",
      name: "Lemiex AI",
      domain: "Vận hành xưởng Lemiex",
      mission: "Hỗ trợ vận hành xưởng",
      riskLevel: "R0",
      boundaries: [],
      capabilities: [
        { id: "lemiex.operations.daily-review", name: "Đánh giá vận hành", description: "", status: "available", riskLevel: "R0", allowedTools: [] },
        { id: "lemiex.operations.ask", name: "Hỏi đáp vận hành", description: "", status: "available", riskLevel: "R0", allowedTools: [] }
      ],
      provider: { enabled: true, model: "" }
    }});
    if (path.startsWith("/api/metrics/") || path.startsWith("/api/reports/")) return route.fulfill({ status: 404, json: { message: "Chưa có dữ liệu" } });
    return route.fulfill({ json: [] });
  });

  await page.goto("/overview");
  await expect(page.getByText("Tổng quan chung")).toBeVisible();
  await expect(page.getByText("Lemiex AI", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CEO AI", { exact: true })).toHaveCount(0);
  await expect(page.getByText("TikTok AI", { exact: true })).toHaveCount(0);

  if (testInfo.project.name === "mobile") await page.locator(".header-menu").click();
  await page.getByRole("button", { name: "Xưởng Lemiex 3D" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Xưởng Lemiex", { exact: true })).toBeVisible();
  await expect(page.getByText("LEMIEX", { exact: true })).toBeVisible();
  await expect(page.getByText("Feline ↔ Xưởng Lemiex")).toHaveCount(0);
  await expect(page.getByText("Sell TikTok", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Phòng Giám đốc", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Trò chuyện với Lemiex AI" })).toBeVisible();

  await page.screenshot({
    path: `../.impeccable/review/office-lemiex-${testInfo.project.name}.png`,
    fullPage: true
  });
});
