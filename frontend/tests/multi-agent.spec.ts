import { expect, test } from "@playwright/test";

const now = "2026-11-18T08:00:00.000Z";
const conversation = {
  id: "meeting-1",
  userId: "manager-1",
  agentId: "multi-agent",
  title: "Kế hoạch tăng trưởng",
  createdAt: now,
  updatedAt: now,
  messages: [],
  _count: { messages: 0 }
};

const session = {
  user: {
    id: "manager-1",
    email: "manager@feline.com",
    displayName: "Quản lý vận hành",
    departmentCode: "EXECUTIVE",
    role: "MANAGER",
    status: "ACTIVE"
  },
  access: {
    platformAdmin: false,
    grants: [
      { id: "ceo", agentId: "ceo-ai", capabilityIds: ["*"], dataScopeIds: ["*"], actions: ["view", "run"], expiresAt: null },
      { id: "tiktok", agentId: "tiktok-ai", capabilityIds: ["*"], dataScopeIds: ["*"], actions: ["view", "run"], expiresAt: null },
      { id: "etsy", agentId: "etsy-ai", capabilityIds: ["*"], dataScopeIds: ["*"], actions: ["view", "run"], expiresAt: null },
      { id: "lemiex", agentId: "lemiex-ai", capabilityIds: ["*"], dataScopeIds: ["*"], actions: ["view", "run"], expiresAt: null }
    ]
  }
};

function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

test("phòng điều hành kết nối nhiều Agent và nhận biên bản streaming", async ({ page }, testInfo) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: session });
    if (path === "/api/health") return route.fulfill({ json: { status: "ok", timestamp: now } });
    if (path === "/api/agents/lemiex") return route.fulfill({ json: { id: "lemiex-ai", name: "Lemiex AI", capabilities: [], boundaries: [], provider: { enabled: true, model: "" } } });
    if (path === "/api/multi-agent/conversations" && request.method() === "GET") return route.fulfill({ json: [conversation] });
    if (path === "/api/multi-agent/conversations/meeting-1" && request.method() === "GET") return route.fulfill({ json: conversation });
    if (path === "/api/multi-agent/conversations/meeting-1/messages/stream") {
      const participants = [
        { agentId: "tiktok-ai", agentName: "TikTok AI", capabilityId: "tiktok.data.ask", status: "COMPLETED", markdown: "TikTok ghi nhận **12 đơn**.", sources: [], runId: "run-tiktok", error: null, usage: null },
        { agentId: "etsy-ai", agentName: "Etsy AI", capabilityId: "etsy.data.ask", status: "COMPLETED", markdown: "Etsy ghi nhận **8 đơn**.", sources: [], runId: "run-etsy", error: null, usage: null },
        { agentId: "lemiex-ai", agentName: "Lemiex AI", capabilityId: "lemiex.operations.ask", status: "COMPLETED", markdown: "Xưởng còn đủ năng lực xử lý.", sources: [], runId: "run-lemiex", error: null, usage: null }
      ];
      const assistantMessage = {
        id: "answer-1", conversationId: "meeting-1", role: "ASSISTANT", status: "COMPLETED",
        content: "## Kết luận điều hành\n\nƯu tiên tăng đơn có kiểm soát và theo dõi năng lực xưởng.",
        reportDate: null, agentRunId: "meeting-run", sources: [], suggestions: [], error: null,
        createdAt: now, updatedAt: now
      };
      const body = [
        event("meeting_started", { meetingId: "meeting-run", participants: participants.map((item) => item.agentId) }),
        ...participants.flatMap((result) => [event("agent_started", { agentId: result.agentId, agentName: result.agentName }), event("agent_completed", { result })]),
        event("synthesis_started", { message: "CEO AI đang tổng hợp ý kiến các Agent" }),
        event("delta", { text: "## Kết luận điều hành\n\n" }),
        event("delta", { text: "Ưu tiên tăng đơn có kiểm soát và theo dõi năng lực xưởng." }),
        event("complete", { assistantMessage, participants, runId: "meeting-run" })
      ].join("");
      return route.fulfill({ status: 200, contentType: "text/event-stream; charset=utf-8", body });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/#/multi-agent");
  await expect(page.getByText("CEO AI chủ trì", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tự động", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByPlaceholder("Giao mục tiêu hoặc vấn đề cần các AI cùng phân tích...").fill("Lập kế hoạch tăng thêm 20 đơn mỗi ngày");
  await page.getByRole("button", { name: "Bắt đầu cuộc họp" }).click();

  await expect(page.getByRole("heading", { name: "Kết luận điều hành" })).toBeVisible();
  await expect(page.getByText("CEO AI đã hoàn tất biên bản cuộc họp")).toBeVisible();
  await expect(page.getByText("Đã gửi báo cáo")).toHaveCount(3);
  await expect(page.getByText("Báo cáo thành phần")).toBeVisible();

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Mở lịch sử cuộc họp" }).click();
    await expect(page.getByText("Các cuộc họp gần đây")).toBeVisible();
    await expect(page.getByText("Kế hoạch tăng trưởng")).toBeVisible();
    await page.waitForTimeout(300);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `../.impeccable/review/multi-agent-${testInfo.project.name}.png`, fullPage: true });
});
