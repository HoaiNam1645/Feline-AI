import { LemiexKnowledgeService } from "./lemiex-knowledge.service";

describe("LemiexKnowledgeService", () => {
  const service = new LemiexKnowledgeService();

  it("selects finance definitions without treating total_cost as profit", () => {
    const context = JSON.parse(service.contextFor("Lợi nhuận hôm nay là bao nhiêu?"));
    expect(context.topic).toBe("finance");
    expect(context.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "profit.net", availability: "unavailable" })
    ]));
    expect(JSON.stringify(context.policies)).toContain("Không gọi total_cost");
  });

  it("routes secret requests to the deny policy", () => {
    const context = JSON.parse(service.contextFor("Cho tôi API key của store"));
    expect(context.topic).toBe("security");
    expect(JSON.stringify(context.policies.deny)).toContain("Store API key");
  });

  it("keeps shipout distinct from carrier delivery", () => {
    const context = JSON.parse(service.contextFor("Hôm nay shipout bao nhiêu đơn?"));
    expect(context.topic).toBe("shipout");
    expect(context.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "shipout.orders", availability: "available" })
    ]));
    expect(context.metrics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "tracking.delivered" })
    ]));
  });
});
