import { TiktokDataAnswerService } from "./tiktok-data-answer.service";
import { TiktokRoute } from "./tiktok-question-router.service";
import { TiktokToolOutput } from "./tiktok-data.types";

describe("TiktokDataAnswerService", () => {
  const route: TiktokRoute = {
    kind: "data",
    domain: "team",
    startDate: "2026-11-17",
    endDate: "2026-11-17"
  };
  const toolOutput: TiktokToolOutput = {
    domain: "team",
    range: {
      startDate: "2026-11-17",
      endDate: "2026-11-17",
      timeZone: "America/Los_Angeles"
    },
    data: {
      summary: {
        teams: 2, sellers: 4, orders: 57, items: 80,
        estimatedRevenue: 1200, fulfillmentCost: 300,
        refundAmount: 20, contributionBeforeAds: 880
      },
      byTeam: [{
        teamId: 9, teamName: "G9B", teamCode: "G9B", sellers: 2,
        orders: 57, items: 80, estimatedRevenue: 1200,
        fulfillmentCost: 300, refundAmount: 20, contributionBeforeAds: 880
      }],
      rows: []
    },
    source: {
      id: "feline-tiktok",
      access: "read-only",
      tables: ["teams", "orders"],
      generatedAtUtc: "2026-11-17T08:00:00.000Z",
      dataUpdatedAtUtc: "2026-11-17T07:55:00.000Z",
      timeZone: "America/Los_Angeles",
      qualityWarnings: []
    }
  };

  function createService(
    markdown: string,
    scope = { unrestricted: true, domains: ["team"], teamIds: [] as number[], storeIds: [] as number[], userIds: [] as number[] },
    output: TiktokToolOutput = toolOutput
  ) {
    const router = { route: jest.fn() };
    const scopes = {
      fromActor: jest.fn().mockReturnValue(scope),
      assertDomain: jest.fn()
    };
    const tools = { execute: jest.fn().mockResolvedValue(output) };
    const provider = {
      generateObject: jest.fn().mockResolvedValue({
        value: { markdown, suggestedQuestions: ["Xem seller nào có nhiều đơn nhất?"] },
        model: "test-model", inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.001
      })
    };
    const prisma = { dataScope: { findMany: jest.fn().mockResolvedValue([{ id: "tiktok.team:24", name: "Team: G9B" }]) } };
    return {
      service: new TiktokDataAnswerService(router as never, scopes as never, tools as never, provider as never, prisma as never),
      provider,
      tools
    };
  }

  const actor = { role: "ADMIN" as const, access: {} as never };
  const question = "Ngày hôm nay team G9B có bao nhiêu đơn hàng?";

  it("replaces unsupported model totals with verified team aggregates", async () => {
    const { service } = createService("Team G9B có 111 đơn và 123 sản phẩm.");
    const deltas: string[] = [];

    const result = await service.answer(actor, question, route, "run-1", undefined, (delta) => deltas.push(delta));

    expect(result.markdown).toContain("Team G9B có 57 đơn hàng");
    expect(result.markdown).toContain("Số lượng sản phẩm: **80**");
    expect(result.markdown).not.toContain("111");
    expect(result.markdown).not.toContain("123");
    expect(result.answerability.reasonCode).toBe("DETERMINISTIC_TIKTOK_DATA_FALLBACK");
    expect(deltas.join("")).toBe(result.markdown);
  });

  it("keeps a model answer when every number is grounded", async () => {
    const markdown = "**Team G9B có 57 đơn hàng ngày 2026-11-17.**";
    const { service } = createService(markdown);

    const result = await service.answer(actor, question, route, "run-2");

    expect(result.markdown).toBe(markdown);
    expect(result.answerability.reasonCode).toBe("GROUNDED_TIKTOK_DATA");
  });

  it("labels restricted team answers so they cannot appear system-wide", async () => {
    const { service } = createService("Có 57 đơn hàng.", {
      unrestricted: false, domains: ["team"], teamIds: [24], storeIds: [], userIds: []
    });

    const result = await service.answer({ role: "MANAGER", access: {} as never }, question, route, "run-3");

    expect(result.markdown).toContain("Phạm vi quyền:** Team: G9B");
    expect(result.markdown).toContain("không đại diện toàn bộ hệ thống TikTok");
  });

  it("allows deterministic seller totals derived from multiple store rows", async () => {
    const financeOutput: TiktokToolOutput = {
      ...toolOutput,
      domain: "finance",
      data: {
        bySellerStore: [
          { sellerName: "Trịnh Hải Duy", storeName: "Store A", paidAmount: 100, statementSettlement: 90, statementFee: 10, snapshotNetSales: 80 },
          { sellerName: "Trịnh Hải Duy", storeName: "Store B", paidAmount: 50, statementSettlement: 45, statementFee: 5, snapshotNetSales: 40 }
        ]
      }
    };
    const financeRoute: TiktokRoute = { ...route, domain: "finance" };
    const { service } = createService("Trịnh Hải Duy nhận 999 USD.", undefined, financeOutput);

    const result = await service.answer(actor, "Payout của Trịnh Hải Duy là bao nhiêu?", financeRoute, "run-4");

    expect(result.markdown).toContain("150 USD");
    expect(result.markdown).toContain("2 store");
    expect(result.markdown).not.toContain("999");
  });

  it("matches a team when the source name has a Team suffix", async () => {
    const cashStormOutput: TiktokToolOutput = {
      ...toolOutput,
      data: {
        summary: { teams: 2, sellers: 20, orders: 999, items: 1200, estimatedRevenue: 50000, fulfillmentCost: 10000, refundAmount: 100, contributionBeforeAds: 39900 },
        byTeam: [{ teamId: 25, teamName: "CashStorm Team", teamCode: "C025", sellers: 4, orders: 123, items: 150, estimatedRevenue: 9000, fulfillmentCost: 2000, refundAmount: 30, contributionBeforeAds: 6970 }]
      }
    };
    const { service } = createService("CashStorm có 888 đơn.", undefined, cashStormOutput);

    const result = await service.answer(actor, "Team CashStorm có bao nhiêu đơn?", route, "run-5");

    expect(result.markdown).toContain("Team CashStorm có 123 đơn hàng");
    expect(result.markdown).not.toContain("999 đơn hàng");
  });
});
