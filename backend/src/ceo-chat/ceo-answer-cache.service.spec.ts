import { CeoAnswerCacheService } from "./ceo-answer-cache.service";

describe("CeoAnswerCacheService", () => {
  const embeddings = {
    model: "test",
    embed: jest.fn(() => [1, 0]),
    similarity: jest.fn((left: number[], right: number[]) => left.reduce((sum, value, index) => sum + value * right[index], 0))
  };

  it("does not cache action requests", () => {
    const service = new CeoAnswerCacheService({} as never, embeddings as never);
    expect(service.isEligible("Chính sách nghỉ phép như thế nào?")).toBe(true);
    expect(service.isEligible("Phê duyệt yêu cầu nghỉ phép này giúp tôi")).toBe(false);
  });

  it("returns a semantic cache hit without model usage", async () => {
    const answer = {
      markdown: "Nội dung [Nguồn 1]",
      sources: [],
      suggestedQuestions: [],
      answerability: { status: "ANSWERED", reasonCode: "GROUNDED_KNOWLEDGE", reason: null },
      usage: { model: "test-model", inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.1 }
    };
    const prisma = { ceoAnswerCache: {
      findMany: jest.fn().mockResolvedValue([{
        id: "cache-1",
        questionEmbedding: [1, 0],
        answer,
        lastHitAt: null
      }]),
      update: jest.fn().mockResolvedValue({})
    } };
    const service = new CeoAnswerCacheService(prisma as never, embeddings as never);
    (service as unknown as { redisUnavailable: boolean }).redisUnavailable = true;
    const result = await service.get({
      agentId: "ceo-ai",
      capabilityId: "ceo.hr.ask",
      scopeKey: "USER:HR",
      knowledgeFingerprint: "knowledge-v1",
      promptVersion: "prompt-v1",
      question: "Quy định nghỉ phép"
    });

    expect(result?.markdown).toBe(answer.markdown);
    expect(result?.usage).toEqual({ model: "answer-cache", inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 });
    expect(prisma.ceoAnswerCache.update).toHaveBeenCalled();
  });

  it("normalizes common question phrasing before semantic comparison", async () => {
    const prisma = { ceoAnswerCache: {
      findMany: jest.fn().mockResolvedValue([])
    } };
    const service = new CeoAnswerCacheService(prisma as never, embeddings as never);
    (service as unknown as { redisUnavailable: boolean }).redisUnavailable = true;
    await service.get({
      agentId: "ceo-ai", capabilityId: "ceo.hr.ask", scopeKey: "USER:HR",
      knowledgeFingerprint: "v1", promptVersion: "p1",
      question: "Quy trình xin nghỉ phép gồm những bước nào?"
    });
    expect(embeddings.embed).toHaveBeenLastCalledWith("xin nghi phep");
  });
});
