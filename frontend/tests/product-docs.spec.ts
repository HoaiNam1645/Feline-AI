import { expect, test } from "@playwright/test";

test("sơ đồ chức năng hiện tại và kế hoạch phát triển hoạt động", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Toàn cảnh hệ thống" })).toBeVisible();
  await expect(page.locator(".docs-sidebar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Feline AI.*Toàn cảnh hệ thống/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /CEO AI.*3 màn hình/ })).toBeVisible();

  await page.getByRole("button", { name: /CEO AI.*3 màn hình/ }).click();
  await expect(page.getByRole("heading", { name: "CEO AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trở về toàn cảnh" })).toBeVisible();
  await expect(page.locator(".map-stage")).toHaveClass(/has-focus/);
  await expect(page.locator(".map-stage")).not.toHaveClass(/camera-moving/);
  await page.getByRole("button", { name: "Trở về toàn cảnh" }).click();
  await expect(page.getByRole("heading", { name: "Toàn cảnh hệ thống" })).toBeVisible();

  await page.getByRole("button", { name: /Chatbox.*Kênh hỏi đáp tri thức nội bộ/ }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "CEO AI — Chatbox" })).toBeVisible();
  await page.getByRole("button", { name: "Đóng chi tiết" }).click();

  await page.getByRole("button", { name: "Chức năng sẽ phát triển" }).click();
  await expect(page.getByRole("heading", { name: "Chức năng sẽ phát triển" })).toBeVisible();
  await page.getByRole("button", { name: /TikTok AI/ }).click();
  await expect(page.getByRole("button", { name: "Chỉnh sửa nhánh" })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa nhánh" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên chức năng").fill("Phân tích chiến dịch");
  await dialog.getByLabel("Mô tả ngắn").fill("Theo dõi kết quả và đề xuất việc cần ưu tiên.");
  await dialog.getByRole("button", { name: "Thêm chức năng" }).click();
  await expect(dialog.getByText("Phân tích chiến dịch")).toBeVisible();
  await page.getByRole("button", { name: "Đóng chi tiết" }).click();
  await expect(page.getByRole("button", { name: /Phân tích chiến dịch/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Chức năng sẽ phát triển" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Phân tích chiến dịch/ })).toBeVisible();
});

test("trackpad pan và zoom đều ngắt camera đang chuyển động", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Kiểm tra trackpad trên viewport desktop");
  await page.goto("/");
  await page.getByRole("button", { name: /Lemiex AI.*4 màn hình/ }).click();
  await expect(page.locator(".map-stage")).toHaveClass(/camera-moving/);

  await page.mouse.move(720, 500);
  await page.mouse.wheel(0, 80);
  await expect(page.locator(".map-stage")).not.toHaveClass(/camera-moving/);
  await expect(page.locator(".map-stage")).toHaveClass(/has-focus/);

  await page.getByRole("button", { name: /Lemiex AI.*4 màn hình/ }).click();
  await expect(page.locator(".map-stage")).toHaveClass(/camera-moving/);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -80);
  await page.keyboard.up("Control");

  await expect(page.locator(".map-stage")).not.toHaveClass(/camera-moving/);
  await expect(page.locator(".map-stage")).toHaveClass(/has-focus/);
});
