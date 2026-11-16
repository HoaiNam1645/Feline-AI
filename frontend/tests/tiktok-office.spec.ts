import { expect, test } from "@playwright/test";

const email = process.env.OFFICE_ADMIN_EMAIL;
const password = process.env.OFFICE_ADMIN_PASSWORD;

test.skip(!email || !password, "OFFICE_ADMIN_EMAIL and OFFICE_ADMIN_PASSWORD are required");
test.setTimeout(120_000);

test("TikTok AI mở hội thoại trực tiếp từ nhân vật 3D", async ({ page }, testInfo) => {
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

  const scene = page.locator(".office-scene-panel");
  const initialCamera = await scene.getAttribute("data-camera-position");
  const interaction = page.getByRole("button", { name: "Trò chuyện với TikTok AI" });
  await expect(interaction).toBeVisible();
  await interaction.evaluate((element) => (element as HTMLButtonElement).click());

  await expect(page.getByRole("region", { name: "Trò chuyện với TikTok AI" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /tôi là TikTok AI/i })).toBeVisible();
  const sceneSpeech = page.locator(".scene-speech-bubble.interaction");
  await expect(sceneSpeech).toContainText("Xin chào");
  await expect(sceneSpeech).toBeHidden({ timeout: 7_000 });
  await expect(scene).toHaveClass(/agent-focus/);
  await expect.poll(() => scene.getAttribute("data-camera-position"), { timeout: 5_000 }).not.toBe(initialCamera);

  const question = "hi";
  await page.getByPlaceholder("Nhập câu hỏi cho TikTok AI...").fill(question);
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(page.locator(".office-character-message.user").last()).toContainText(question);
  await expect(sceneSpeech).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".office-character-message.assistant.completed").last()).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(".office-character-message.assistant.completed").last()).toContainText("TikTok AI");
  await expect(page.locator(".office-character-message.assistant.completed").last()).not.toContainText("chưa tìm thấy tài liệu");
  await expect(sceneSpeech).not.toBeEmpty();

  await page.screenshot({
    path: `../.impeccable/review/office-tiktok-${testInfo.project.name}.png`,
    fullPage: true
  });

  await page.getByRole("button", { name: "Đóng cuộc trò chuyện" }).click();
  await expect(page.getByRole("region", { name: "Trò chuyện với TikTok AI" })).toBeHidden();
  await expect(scene).not.toHaveClass(/agent-focus/);
  await expect.poll(async () => {
    const current = (await scene.getAttribute("data-camera-position"))!.split(",").map(Number);
    const initial = initialCamera!.split(",").map(Number);
    return Math.max(...current.map((value, index) => Math.abs(value - initial[index])));
  }, { timeout: 5_000 }).toBeLessThan(0.02);
});
