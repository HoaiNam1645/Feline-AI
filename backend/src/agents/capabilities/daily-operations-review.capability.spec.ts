import { DailyOperationsReviewCapability } from "./daily-operations-review.capability";

function contextTools() {
  return {
    execute: jest.fn(async (_runId: string, toolId: string) => {
      if (toolId === "lemiex.metrics.daily-snapshot") {
        return {
          snapshotId: "snapshot-1",
          metrics: {
            meta: { reportDate: "2026-10-29" },
            intake: { orders: 99 },
            workflow: [],
            shipout: { completedOrders: 158 },
            backlog: { totalOrders: 184, byAgeBand: [{ ageBand: ">=72h", orders: 57 }] },
            events: [],
            remakes: { cases: 0 },
            dataQuality: { trackingRows: 0 }
          }
        };
      }
      return {
        templateVersion: "workshop-daily-v0.1",
        content: "99 đơn; shipout 158; backlog 184; có 57 đơn từ 72 giờ"
      };
    })
  };
}

describe("DailyOperationsReviewCapability", () => {
  it("uses curated tools and returns a grounded structured review", async () => {
    const tools = contextTools();
    const provider = {
      generateObject: jest.fn(async (request) => ({
        value: {
          summary: "Tiếp nhận 99 đơn và backlog hiện tại là 184 đơn.",
          dataShows: ["Shipout đạt 158 đơn."],
          needsInvestigation: ["Kiểm tra 57 đơn từ 72 giờ."],
          operationalPriorities: [],
          limitations: ["Tracking có 0 bản ghi."]
        },
        model: "test-model",
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostUsd: 0.001,
        request
      }))
    };
    const capability = new DailyOperationsReviewCapability(
      tools as never,
      provider as never
    );

    const result = await capability.execute("run-1", {
      reportDate: "2026-10-29"
    });

    expect(result.metricSnapshotId).toBe("snapshot-1");
    expect(result.output.summary).toContain("99 đơn");
    expect(tools.execute).toHaveBeenCalledTimes(2);
    const request = provider.generateObject.mock.calls[0][0];
    expect(request.user).not.toContain("provisionalCosts");
    expect(request.user).not.toContain("SOURCE_MYSQL");
  });

  it("validates its own input so the orchestrator stays generic", () => {
    const capability = new DailyOperationsReviewCapability(
      contextTools() as never,
      { generateObject: jest.fn() } as never
    );

    expect(capability.validateInput({ reportDate: "2026-10-29" })).toEqual({
      reportDate: "2026-10-29"
    });
    expect(() => capability.validateInput({ reportDate: "not-a-date" })).toThrow();
  });

  it("rejects numerical claims not present in tool context", async () => {
    const provider = {
      generateObject: jest.fn(async () => ({
        value: {
          summary: "Có 999 đơn lỗi.",
          dataShows: ["Tiếp nhận 99 đơn."],
          needsInvestigation: [],
          operationalPriorities: [],
          limitations: []
        },
        model: "test-model",
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostUsd: null
      }))
    };
    const capability = new DailyOperationsReviewCapability(
      contextTools() as never,
      provider as never
    );

    await expect(capability.execute("run-1", {
      reportDate: "2026-10-29"
    })).rejects.toThrow("unsupported numbers: 999");
  });

  it("normalizes omitted optional empty arrays without weakening grounding", async () => {
    const provider = {
      generateObject: jest.fn(async () => ({
        value: {
          summary: "Tiếp nhận 99 đơn.",
          dataShows: ["Backlog có 184 đơn."],
          needsInvestigation: [],
          operationalPriorities: []
        },
        model: "test-model",
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostUsd: null
      }))
    };
    const capability = new DailyOperationsReviewCapability(
      contextTools() as never,
      provider as never
    );

    const result = await capability.execute("run-1", {
      reportDate: "2026-10-29"
    });

    expect(result.output.limitations).toEqual([]);
  });
});
