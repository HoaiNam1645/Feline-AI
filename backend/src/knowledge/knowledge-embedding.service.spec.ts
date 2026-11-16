import { KnowledgeEmbeddingService } from "./knowledge-embedding.service";

describe("KnowledgeEmbeddingService", () => {
  const service = new KnowledgeEmbeddingService();

  it("creates deterministic normalized vectors", () => {
    const first = service.embed("Quy trình xin nghỉ phép của nhân viên");
    const second = service.embed("Quy trình xin nghỉ phép của nhân viên");
    expect(first).toEqual(second);
    expect(first).toHaveLength(service.dimensions);
    const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it("ranks related text above unrelated text", () => {
    const query = service.embed("nhân viên xin nghỉ phép");
    const related = service.embed("quy định nghỉ phép và bàn giao công việc");
    const unrelated = service.embed("cách bảo trì máy in và thay mực");
    expect(service.similarity(query, related)).toBeGreaterThan(service.similarity(query, unrelated));
  });
});
