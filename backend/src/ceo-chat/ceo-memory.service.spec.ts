import { CeoMemoryService } from "./ceo-memory.service";

describe("CeoMemoryService", () => {
  const embeddings = {
    model: "test-embedding",
    embed: jest.fn((value: string) => value.includes("nghỉ phép") ? [1, 0] : [0, 1]),
    similarity: jest.fn((left: number[], right: number[]) => left.reduce((sum, value, index) => sum + value * right[index], 0))
  };

  it("recalls only relevant memories owned by the same user and agent", async () => {
    const prisma = {
      conversationMemory: {
        findMany: jest.fn().mockResolvedValue([
          { conversationId: "old-1", summary: "Trao đổi về nghỉ phép", embedding: [1, 0], updatedAt: new Date("2026-11-10") },
          { conversationId: "old-2", summary: "Trao đổi về thiết bị", embedding: [0, 1], updatedAt: new Date("2026-11-09") }
        ])
      }
    };
    const service = new CeoMemoryService(prisma as never, embeddings as never);
    const result = await service.recall("user-1", "ceo-ai", "Tôi muốn hỏi tiếp về nghỉ phép", "current");

    expect(prisma.conversationMemory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", agentId: "ceo-ai", conversationId: { not: "current" } }
    }));
    expect(result.map((item) => item.conversationId)).toEqual(["old-1"]);
  });

  it("stores a compact rolling memory from completed messages", async () => {
    const prisma = {
      chatMessage: { findMany: jest.fn().mockResolvedValue([
        { role: "ASSISTANT", status: "COMPLETED", content: "Bạn cần báo quản lý.", createdAt: new Date("2026-11-11T01:01:00Z") },
        { role: "USER", status: "COMPLETED", content: "Tôi muốn xin nghỉ phép.", createdAt: new Date("2026-11-11T01:00:00Z") }
      ]) },
      conversationMemory: { upsert: jest.fn().mockResolvedValue({}) }
    };
    const service = new CeoMemoryService(prisma as never, embeddings as never);
    await service.refresh("user-1", "ceo-ai", "conversation-1");

    expect(prisma.conversationMemory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversationId: "conversation-1" },
      create: expect.objectContaining({ userId: "user-1", agentId: "ceo-ai", messageCount: 2 })
    }));
  });

  it("uses the latest session for an explicit cross-session follow-up", async () => {
    const latest = { conversationId: "old-1", summary: "Trao đổi về nghỉ phép", embedding: [1, 0], updatedAt: new Date("2026-11-10") };
    const prisma = { conversationMemory: { findMany: jest.fn().mockResolvedValue([latest]) } };
    embeddings.embed.mockReturnValueOnce([0, 1]);
    const service = new CeoMemoryService(prisma as never, embeddings as never);

    const result = await service.recall("user-1", "ceo-ai", "Còn trường hợp đó thì sao?", "current");

    expect(result).toEqual([{
      conversationId: latest.conversationId,
      summary: latest.summary,
      updatedAt: latest.updatedAt,
      score: 0
    }]);
  });
});
