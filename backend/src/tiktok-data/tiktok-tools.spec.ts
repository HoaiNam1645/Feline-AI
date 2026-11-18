import { TiktokTeamTool } from "./tiktok-tools";

describe("TiktokTeamTool", () => {
  it("adds deterministic team totals to seller-level query rows", async () => {
    const db = {
      query: jest.fn().mockResolvedValue([
        {
          teamId: 9, teamName: "G9B", teamCode: "G9B", sellerId: 1, sellerName: "Seller A",
          orders: "50", items: "70", estimatedRevenue: "1000", fulfillmentCost: "250",
          refundAmount: "20", contributionBeforeAds: "730", dataUpdatedAt: "2026-11-17 08:00:00"
        },
        {
          teamId: 9, teamName: "G9B", teamCode: "G9B", sellerId: 2, sellerName: "Seller B",
          orders: "61", items: "83", estimatedRevenue: "1200", fulfillmentCost: "300",
          refundAmount: "30", contributionBeforeAds: "870", dataUpdatedAt: "2026-11-17 08:00:00"
        }
      ])
    };
    const scopes = {
      assertDomain: jest.fn(),
      orderPredicate: jest.fn().mockReturnValue({ sql: "1=1", params: [] })
    };
    const tool = new TiktokTeamTool(db as never, scopes as never);

    const result = await tool.execute({
      startDate: "2026-11-17", endDate: "2026-11-17", timeZone: "America/Los_Angeles",
      scope: { unrestricted: true, domains: ["team"], teamIds: [], storeIds: [], userIds: [] },
      question: "Hôm nay team G9B có bao nhiêu đơn hàng?"
    });

    expect((result.data as any).byTeam).toEqual([expect.objectContaining({
      teamName: "G9B", teamCode: "G9B", sellers: 2, orders: 111, items: 153
    })]);
    expect((result.data as any).summary).toEqual(expect.objectContaining({
      teams: 1, sellers: 2, orders: 111, items: 153
    }));
  });
});
