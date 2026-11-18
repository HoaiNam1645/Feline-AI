import { EtsyDataAnswerService } from "./etsy-data-answer.service";

describe("EtsyDataAnswerService", () => {
  it("applies actor scope before loading data", async () => {
    const router = { route: jest.fn() };
    const scopes = { fromActor: jest.fn().mockReturnValue({ sellerTeamIds: ["team-g9b"], shopIds: [], sellerIds: [] }) };
    const dashboard = {
      report: { startDate: "2026-11-01", endDate: "2026-11-18", timeZone: "America/Los_Angeles", currency: "USD", generatedAt: "2026-11-18T00:00:00Z" },
      source: { dataUpdatedAt: "2026-11-18T00:00:00Z", shopSyncedAt: null },
      filters: { sellerTeams: [{ id: "team-g9b", name: "G9B" }], shops: [], sellers: [{ id: "seller-1", name: "Alice", email: "alice@example.com", teamId: "team-g9b" }] },
      summary: { orders: 10, items: 12, grossBookedValue: 100, recognizedRevenue: 90, etsyNet: 80, fulfillmentCost: 10, designCost: 5, refundAmount: 0, manualCost: 0, manualCostVnd: 0, operationalProfit: 65, funds: 0, fundsVnd: 0, shops: 1, activeSellers: 2 },
      statuses: [], trend: [], sellerTeams: [{ id: "team-g9b", name: "G9B", members: 2, orders: 10, items: 12, grossBookedValue: 100, net: 80, profit: 65 }], shops: [], sellers: [{ id: "seller-1", name: "Alice", email: "alice@example.com", teamId: "team-g9b", teamName: "G9B", orders: 10, items: 12, grossBookedValue: 100, net: 80, fulfillmentCost: 10, designCost: 5, refundAmount: 0, profit: 65 }], topProducts: [],
      quality: { totalOrders: 10, noSkuOrders: 0, unknownSellerOrders: 0, fallbackNetOrders: 0, orderNetOrders: 10, actualNetOrders: 10, missingShopOrders: 0, unattributedOrders: 0, attributionRate: 1, unknownPrefixes: [] }
    };
    const source = { dashboard: jest.fn().mockResolvedValue(dashboard) };
    const provider = { generateObject: jest.fn().mockResolvedValue({ value: { markdown: "Team G9B có 10 đơn.", suggestedQuestions: [] }, model: "test", inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0 }) };
    const prisma = { agentToolCall: { create: jest.fn().mockResolvedValue({ id: "call-1" }), update: jest.fn().mockResolvedValue({}) } };
    const service = new EtsyDataAnswerService(router as never, scopes as never, source as never, provider as never, prisma as never);

    const result = await service.answer({ role: "MANAGER", access: {} as never }, "Team G9B có bao nhiêu đơn?", { kind: "data", domain: "team", startDate: "2026-11-01", endDate: "2026-11-18" }, "run-1");

    expect(source.dashboard).toHaveBeenCalledWith("2026-11-01", "2026-11-18", { sellerTeamIds: ["team-g9b"], shopIds: [], sellerIds: [] });
    expect(result.markdown).toContain("Phạm vi quyền:** Team: G9B");
    const providerInput = provider.generateObject.mock.calls[0][0];
    expect(providerInput.user).toContain("Alice");
    expect(providerInput.user).not.toContain("alice@example.com");
  });

  it("ranks shops instead of treating 'shop nào' as a named shop", () => {
    const service = new EtsyDataAnswerService({} as never, {} as never, {} as never, {} as never, {} as never);
    const fallback = (service as unknown as {
      financeFallback: (route: Record<string, unknown>, data: unknown, question: string) => string;
    }).financeFallback.bind(service);

    const answer = fallback(
      { startDate: "2026-10-01", endDate: "2026-10-31" },
      { shops: [{ name: "Shop A", orders: 2, net: 80, profit: 30 }, { name: "Shop B", orders: 3, net: 120, profit: 70 }] },
      "Shop nào lợi nhuận cao nhất?"
    );

    expect(answer).toContain("Shop B");
    expect(answer).toContain("70 USD");
    expect(answer).not.toContain("Shop Shop A");
  });
});
