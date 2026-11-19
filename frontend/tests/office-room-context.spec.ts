import { expect, test } from "@playwright/test";

const now = "2026-11-18T08:00:00.000Z";
const session = {
  user: { id: "admin-1", email: "admin@feline.com", displayName: "Nam Hoài", departmentCode: null, role: "ADMIN", status: "ACTIVE" },
  access: { platformAdmin: true, grants: [] }
};

function conversation(agentId: string) {
  return { id: `${agentId}-conversation`, userId: "admin-1", agentId, title: "Cuộc trò chuyện", createdAt: now, updatedAt: now, messages: [], _count: { messages: 0 } };
}

test("panel bên phải đổi theo phòng ban được chọn", async ({ page }) => {
  test.setTimeout(90_000);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: session });
    if (path === "/api/health") return route.fulfill({ json: { status: "ok", timestamp: now } });
    if (path === "/api/source/health") return route.fulfill({ json: { status: "ok" } });
    if (path === "/api/agents/lemiex") return route.fulfill({ json: { id: "lemiex-ai", name: "Lemiex AI", capabilities: [], boundaries: [], provider: { enabled: true, model: "" } } });
    const match = path.match(/^\/api\/chat\/(ceo|tiktok|etsy)\/conversations(?:\/([^/]+))?$/);
    if (match) {
      const item = conversation(`${match[1]}-ai`);
      return route.fulfill({ json: match[2] ? item : [item] });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/#/office");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Phòng Giám đốc CEO AI Feline" }).click({ force: true });
  await expect(page.getByRole("heading", { name: /tôi là CEO AI/i })).toBeVisible();

  await page.getByRole("button", { name: "Đặt lại góc nhìn" }).click();
  await page.getByRole("button", { name: "Sell Etsy Sản phẩm & gian hàng" }).click({ force: true });
  await expect(page.getByRole("heading", { name: /tôi là Etsy AI/i })).toBeVisible();
  await expect(page.getByPlaceholder("Nhập câu hỏi cho Etsy AI...")).toBeVisible();

  await page.getByRole("button", { name: "Đặt lại góc nhìn" }).click();
  await page.getByRole("button", { name: "Sell TikTok Nội dung & livestream" }).click({ force: true });
  await expect(page.getByRole("heading", { name: /tôi là TikTok AI/i })).toBeVisible();
  await expect(page.getByPlaceholder("Nhập câu hỏi cho TikTok AI...")).toBeVisible();

  await page.getByTitle("Xem Phòng Điều hành AI").click();
  await expect(page.getByRole("heading", { name: "Điều phối nhiều AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Giao mục tiêu cho các AI/ })).toBeVisible();

  await page.getByTitle("Xem Phòng họp AI").click();
  await expect(page.getByRole("heading", { name: "Họp và chốt kế hoạch" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mở cuộc họp AI/ })).toBeVisible();
});
