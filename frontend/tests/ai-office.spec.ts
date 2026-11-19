import { expect, test } from "@playwright/test";

const email = process.env.OFFICE_ADMIN_EMAIL;
const password = process.env.OFFICE_ADMIN_PASSWORD;

test.skip(!email || !password, "OFFICE_ADMIN_EMAIL and OFFICE_ADMIN_PASSWORD are required");
test.setTimeout(180_000);

test("văn phòng 3D thực hiện nhiệm vụ liên công ty", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(email!);
  await page.locator("#login-password").fill(password!);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Tổng quan chung")).toBeVisible();

  if (testInfo.project.name === "mobile") {
    await page.locator(".header-menu").click();
  }
  await page.getByRole("button", { name: "Văn phòng AI" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Feline AI · 6 khu chức năng")).toBeVisible();
  if (testInfo.project.name === "desktop") {
    await expect(page.getByText("CEO AI · Phòng Giám đốc")).toBeVisible();
  }
  await expect(page.getByText("CEO AI Feline").first()).toBeVisible();
  const ceoState = page.getByLabel("Trạng thái CEO AI Feline");
  await expect(ceoState).toBeVisible();
  await ceoState.selectOption("DESK");
  await expect(page.locator(".scene-character-status.director .scene-character-activity")).toHaveText("Đang di chuyển");
  await expect(page.locator(".scene-character-status.director .scene-character-activity")).toHaveText("Đang làm việc tại bàn", { timeout: 18_000 });
  await ceoState.selectOption("SMOKING");
  await expect(page.locator(".scene-character-status.director .scene-character-activity")).toHaveText("Đang di chuyển");
  await expect(page.locator(".scene-character-status.director .scene-character-activity")).toHaveText("Đang hút thuốc", { timeout: 18_000 });
  await page.screenshot({ path: `../.impeccable/review/office-${testInfo.project.name}-ceo-smoking.png`, fullPage: true });
  await ceoState.selectOption("RESTING");
  await expect(page.locator(".scene-department-sign.etsy strong")).toHaveText("Sell Etsy");
  await expect(page.locator(".scene-department-sign.tiktok strong")).toHaveText("Sell TikTok");
  await expect(page.locator(".scene-department-sign.fela strong")).toHaveText("Sell Fela");
  await expect(page.locator(".scene-department-sign.operations strong")).toHaveText("Điều hành AI");
  await expect(page.locator(".scene-department-sign.meeting strong")).toHaveText("Phòng họp AI");
  await expect(page.locator(".scene-company-sign.lemiex strong")).toHaveText("LEMIEX");
  await page.getByTitle("Xem Phòng họp AI").click();
  await expect(page.getByTitle("Xem Phòng họp AI")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".scene-character-status.etsy")).toHaveCount(1);
  await expect(page.locator(".scene-character-status.tiktok")).toHaveCount(1);
  await expect(page.locator(".scene-character-status.fela")).toHaveCount(1);
  await expect(page.locator(".scene-character-status.director")).toHaveCount(1);
  await page.getByRole("button", { name: "Đặt lại góc nhìn" }).click();
  await expect(page.getByTitle("Xem Phòng họp AI")).toHaveAttribute("aria-pressed", "false");
  const scene = page.locator(".office-scene-panel");
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await expect(scene).toHaveAttribute("data-camera-position", /.+/);
  const initialCamera = await scene.getAttribute("data-camera-position");
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.48);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.68, box!.y + box!.height * 0.38, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => scene.getAttribute("data-camera-position")).not.toBe(initialCamera);
  const rotatedCamera = await scene.getAttribute("data-camera-position");
  await page.getByRole("button", { name: "Di chuyển" }).click();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.58, box!.y + box!.height * 0.58, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => scene.getAttribute("data-camera-position")).not.toBe(rotatedCamera);
  const pannedCamera = await scene.getAttribute("data-camera-position");
  await page.getByRole("button", { name: "Phóng to" }).click();
  await expect.poll(() => scene.getAttribute("data-camera-position")).not.toBe(pannedCamera);
  const buttonZoomCamera = await scene.getAttribute("data-camera-position");
  await page.mouse.move(box!.x + box!.width * 0.52, box!.y + box!.height * 0.52);
  await page.mouse.wheel(0, 480);
  await expect.poll(() => scene.getAttribute("data-camera-position")).not.toBe(buttonZoomCamera);
  await page.getByRole("button", { name: "Đặt lại góc nhìn" }).click();
  await expect.poll(async () => {
    const current = (await scene.getAttribute("data-camera-position"))!.split(",").map(Number);
    const initial = initialCamera!.split(",").map(Number);
    return Math.max(...current.map((value, index) => Math.abs(value - initial[index])));
  }).toBeLessThan(0.02);
  if (testInfo.project.name === "desktop") {
    await expect(page.locator(".scene-character-status.director .scene-character-activity")).toHaveText("Đang nghỉ ngắn", { timeout: 12_000 });
    await page.screenshot({
      path: "../.impeccable/review/office-desktop-ceo-resting.png",
      fullPage: true
    });
  }
  await page.screenshot({
    path: `../.impeccable/review/office-${testInfo.project.name}.png`,
    fullPage: true
  });

  await page.getByRole("button", { name: "Hôm nay Lemiex có bao nhiêu đơn?" }).click();
  await expect(page.locator(".office-agent-row.courier small")).toHaveText("Đang sang Lemiex");
  await page.waitForTimeout(2200);
  await page.screenshot({
    path: `../.impeccable/review/office-${testInfo.project.name}-in-transit.png`,
    fullPage: true
  });
  await expect(page.locator(".office-live-state")).toContainText("Lemiex đang tiếp nhận yêu cầu", { timeout: 12_000 });
  await expect(page.locator(".office-agent-row.courier small")).toHaveText("Đang bàn giao yêu cầu");
  await expect(page.locator(".office-agent-row.lemiex small")).toHaveText("Đang tiếp nhận yêu cầu");
  await page.screenshot({
    path: `../.impeccable/review/office-${testInfo.project.name}-arrival.png`,
    fullPage: true
  });
  await expect(page.locator(".office-live-state")).toContainText("Đang trình báo cáo cho CEO AI", { timeout: 45_000 });
  await expect(page.locator(".office-agent-row.courier small")).toHaveText("Đang trình báo cáo");
  await expect(page.locator(".office-agent-row.feline small")).toHaveText("Đang nhận báo cáo");
  await page.screenshot({
    path: `../.impeccable/review/office-${testInfo.project.name}-delivery.png`,
    fullPage: true
  });
  await expect(page.getByText("ĐÃ NHẬN BÁO CÁO")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".office-agent-row.feline small")).toHaveText("Đã nhận kết quả");
  await expect(page.getByText("Nguồn: shop-test · chỉ đọc")).toBeVisible();
  await page.screenshot({
    path: `../.impeccable/review/office-${testInfo.project.name}-result.png`,
    fullPage: true
  });
});
