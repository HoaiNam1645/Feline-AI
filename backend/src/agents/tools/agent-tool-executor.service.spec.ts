import { AgentToolExecutorService } from "./agent-tool-executor.service";

describe("AgentToolExecutorService", () => {
  function setup(capabilityId: string) {
    const prisma = {
      agentRun: {
        findUnique: jest.fn(async () => ({ capabilityId }))
      },
      agentToolCall: {
        create: jest.fn(async () => ({ id: "call-1" })),
        update: jest.fn(async () => undefined)
      }
    };
    const snapshotTool = {
      id: "lemiex.metrics.daily-snapshot",
      description: "snapshot",
      execute: jest.fn(async () => ({ snapshotId: "snapshot-1" }))
    };
    const reportTool = {
      id: "lemiex.reports.daily-artifact",
      description: "report",
      execute: jest.fn(async () => ({ content: "report" }))
    };
    const liveDailyMetricsTool = {
      id: "lemiex.metrics.live-daily",
      description: "live metrics",
      execute: jest.fn(async () => ({ metrics: {} }))
    };
    const inventoryMetricsTool = {
      id: "lemiex.metrics.inventory",
      description: "inventory metrics",
      execute: jest.fn(async () => ({ products: [] }))
    };
    return {
      prisma,
      snapshotTool,
      executor: new AgentToolExecutorService(
        prisma as never,
        snapshotTool as never,
        reportTool as never,
        liveDailyMetricsTool as never,
        inventoryMetricsTool as never
      )
    };
  }

  it("executes and audits a tool declared by the capability", async () => {
    const { executor, prisma, snapshotTool } = setup(
      "lemiex.operations.daily-review"
    );

    await expect(executor.execute("run-1", snapshotTool.id, {})).resolves.toEqual({
      snapshotId: "snapshot-1"
    });
    expect(prisma.agentToolCall.create).toHaveBeenCalled();
    expect(prisma.agentToolCall.update).toHaveBeenCalled();
  });

  it("blocks a registered tool that is outside the capability allowlist", async () => {
    const { executor, prisma, snapshotTool } = setup(
      "lemiex.operations.data-quality-review"
    );

    await expect(executor.execute("run-1", snapshotTool.id, {})).rejects.toThrow(
      "is not allowed"
    );
    expect(prisma.agentToolCall.create).not.toHaveBeenCalled();
  });
});
