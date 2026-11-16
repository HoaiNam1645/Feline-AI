import { KnowledgeChunkingService } from "./knowledge-chunking.service";

describe("KnowledgeChunkingService", () => {
  const service = new KnowledgeChunkingService();

  it("keeps short documents in one chunk", () => {
    const chunks = service.split("Nội quy công ty.\n\nNhân viên cần chấm công đúng giờ.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("chấm công");
    expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
  });

  it("splits long content without losing the end", () => {
    const content = Array.from({ length: 30 }, (_, index) => `Mục ${index + 1}. Quy định này mô tả trách nhiệm và cách xử lý yêu cầu nội bộ.`).join("\n\n");
    const chunks = service.split(content, 300, 40);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.at(-1)?.content).toContain("Mục 30");
    expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, index) => index));
  });
});
