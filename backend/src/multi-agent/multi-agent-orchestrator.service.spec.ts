import { UserRole } from "@prisma/client";
import { MultiAgentOrchestratorService } from "./multi-agent-orchestrator.service";
import { MultiAgentRouterService } from "./multi-agent-router.service";

function harness() {
  let messageIndex = 0;
  let runIndex = 0;
  const tx = {
    chatMessage: { create: jest.fn(async ({ data }) => ({ id: `message-${++messageIndex}`, createdAt: new Date(), ...data })) },
    chatConversation: { update: jest.fn(async () => ({})) }
  };
  const prisma = {
    chatConversation: {
      findFirst: jest.fn(async () => ({ id: "conversation-1", userId: "user-1", agentId: "multi-agent", title: "Cuộc họp", messages: [] })),
      findMany: jest.fn(), create: jest.fn()
    },
    chatMessage: { update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })) },
    agentRun: {
      create: jest.fn(async ({ data }) => ({ id: `run-${++runIndex}`, startedAt: new Date(), ...data })),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, startedAt: new Date(), ...data })),
      updateMany: jest.fn()
    },
    $transaction: jest.fn(async (callback) => callback(tx))
  };
  const provider = {
    generateObject: jest.fn(async ({ onTextDelta }) => {
      onTextDelta?.("Kế hoạch tổng hợp");
      return { value: { markdown: "Kế hoạch tổng hợp", suggestedQuestions: [] }, model: "test-model", inputTokens: 20, outputTokens: 10, estimatedCostUsd: 0.001 };
    })
  };
  const operations = {
    start: jest.fn(async () => ({ auditId: "audit-1", startedAt: new Date() })),
    attachMessages: jest.fn(), complete: jest.fn(), fail: jest.fn()
  };
  const usage = { model: "test-model", inputTokens: 5, outputTokens: 4, estimatedCostUsd: 0.0001 };
  const ceo = { answer: jest.fn(async () => ({ markdown: "Ý kiến CEO", sources: [], suggestedQuestions: [], usage })) };
  const tiktokKnowledge = { answer: jest.fn() };
  const tiktokData = { route: jest.fn(() => ({ kind: "data", domain: "overview", startDate: "2026-11-18", endDate: "2026-11-18" })), answer: jest.fn(async () => ({ markdown: "TikTok có dữ liệu", sources: [], suggestedQuestions: [], usage })) };
  const etsyKnowledge = { answer: jest.fn() };
  const etsyData = { route: jest.fn(() => ({ kind: "data", domain: "overview", startDate: "2026-11-18", endDate: "2026-11-18" })), answer: jest.fn(async () => ({ markdown: "Etsy có dữ liệu", sources: [], suggestedQuestions: [], usage })) };
  const lemiex = { run: jest.fn() };
  const service = new MultiAgentOrchestratorService(
    prisma as never,
    new MultiAgentRouterService(),
    provider as never,
    operations as never,
    ceo as never,
    tiktokKnowledge as never,
    tiktokData as never,
    etsyKnowledge as never,
    etsyData as never,
    lemiex as never
  );
  const actor = { id: "user-1", role: UserRole.ADMIN, departmentCode: null, access: { platformAdmin: true, grants: [] } };
  return { service, actor, provider, operations, prisma, tiktokData, etsyData };
}

describe("MultiAgentOrchestratorService", () => {
  it("avoids an extra synthesis model call for a single agent", async () => {
    const { service, actor, provider, prisma } = harness();
    const events: string[] = [];
    const result = await service.answer(actor, "conversation-1", { content: "Chính sách nghỉ phép", participantAgentIds: ["ceo-ai"] }, undefined, (event) => events.push(event.type));
    expect(result.participants).toHaveLength(1);
    expect(provider.generateObject).not.toHaveBeenCalled();
    expect(prisma.agentRun.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ inputTokens: 5, outputTokens: 4 })
    }));
    expect(events).toEqual(expect.arrayContaining(["meeting_started", "agent_started", "agent_completed", "synthesis_started", "delta", "complete"]));
  });

  it("runs multiple agents and lets CEO synthesize their outputs", async () => {
    const { service, actor, provider, tiktokData, etsyData, operations } = harness();
    const result = await service.answer(actor, "conversation-1", {
      content: "Lên kế hoạch tăng đơn",
      participantAgentIds: ["tiktok-ai", "etsy-ai"]
    });
    expect(tiktokData.answer).toHaveBeenCalled();
    expect(etsyData.answer).toHaveBeenCalled();
    expect(provider.generateObject).toHaveBeenCalledTimes(1);
    expect(result.participants.map((item) => item.agentId)).toEqual(["tiktok-ai", "etsy-ai"]);
    expect(operations.complete).toHaveBeenCalled();
  });
});
