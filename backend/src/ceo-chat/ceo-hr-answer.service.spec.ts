import { CeoHrAnswerService } from "./ceo-hr-answer.service";

const actor = { id: "user-1", role: "USER" as const, departmentCode: "HR" };
const disabledCache = { isEligible: jest.fn().mockReturnValue(false) };
const candidate = {
  score: 0.72,
  chunkId: "chunk-1",
  chunkIndex: 0,
  content: "Nhân viên gửi yêu cầu nghỉ phép cho quản lý trực tiếp trước ít nhất hai ngày làm việc.",
  document: {
    id: "doc-1",
    title: "Chính sách nghỉ phép",
    category: "Nhân sự",
    ownerName: "HR Manager",
    ownerDepartmentName: "Nhân sự",
    versionNumber: 1,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null
  }
};

describe("CeoHrAnswerService", () => {
  it("records an unanswered question without calling the model when no relevant source exists", async () => {
    const knowledge = { search: jest.fn().mockResolvedValue([]) };
    const provider = { generateObject: jest.fn() };
    const service = new CeoHrAnswerService(knowledge as never, provider as never, disabledCache as never);
    const result = await service.answer(actor, "Công ty có bảo hiểm thú cưng không?", []);
    expect(result.answerability.status).toBe("UNANSWERED");
    expect(result.answerability.reasonCode).toBe("NO_RELEVANT_KNOWLEDGE");
    expect(result.sources).toEqual([]);
    expect(provider.generateObject).not.toHaveBeenCalled();
  });

  it("does not call the model when an unrelated result only overlaps generic policy terms", async () => {
    const unrelatedCandidate = {
      ...candidate,
      content: "Nhân viên cần thông báo cho quản lý và phối hợp cùng đồng nghiệp khi có thay đổi lịch làm việc."
    };
    const knowledge = { search: jest.fn().mockResolvedValue([unrelatedCandidate]) };
    const provider = { generateObject: jest.fn() };
    const service = new CeoHrAnswerService(knowledge as never, provider as never, disabledCache as never);
    const result = await service.answer(actor, "Công ty có chính sách bảo hiểm thú cưng không?", []);
    expect(result.answerability.status).toBe("UNANSWERED");
    expect(result.answerability.reasonCode).toBe("NO_RELEVANT_KNOWLEDGE");
    expect(result.usage).toEqual({ model: null, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null });
    expect(provider.generateObject).not.toHaveBeenCalled();
  });

  it("returns only grounded answers with validated citations", async () => {
    const knowledge = { search: jest.fn().mockResolvedValue([candidate]) };
    const provider = { generateObject: jest.fn().mockResolvedValue({
      value: {
        answerable: true,
        markdown: "Bạn cần gửi yêu cầu cho quản lý trực tiếp trước ít nhất hai ngày làm việc. [Nguồn 1]",
        usedSourceIds: [1],
        suggestedQuestions: ["Tôi cần bàn giao công việc thế nào?"]
      },
      model: "test-model",
      inputTokens: 100,
      outputTokens: 40,
      estimatedCostUsd: 0.001
    }) };
    const service = new CeoHrAnswerService(knowledge as never, provider as never, disabledCache as never);
    const result = await service.answer(actor, "Tôi cần xin nghỉ phép như thế nào?", []);
    expect(result.answerability.status).toBe("ANSWERED");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe("Chính sách nghỉ phép");
    expect(result.markdown).toContain("[Nguồn 1]");
  });

  it("forwards structured markdown deltas while the model is generating", async () => {
    const knowledge = { search: jest.fn().mockResolvedValue([candidate]) };
    const markdown = "Bạn cần gửi yêu cầu cho quản lý trực tiếp. [Nguồn 1]";
    const provider = {
      generateObject: jest.fn(async (request: { onTextDelta?: (text: string) => void }) => {
        request.onTextDelta?.("Bạn cần gửi ");
        request.onTextDelta?.("yêu cầu cho quản lý trực tiếp. [Nguồn 1]");
        return {
          value: { answerable: true, markdown, usedSourceIds: [1], suggestedQuestions: [] },
          model: "test-model",
          inputTokens: 100,
          outputTokens: 30,
          estimatedCostUsd: null
        };
      })
    };
    const onTextDelta = jest.fn();
    const service = new CeoHrAnswerService(knowledge as never, provider as never, disabledCache as never);

    const result = await service.answer(actor, "Tôi cần xin nghỉ phép như thế nào?", [], undefined, onTextDelta);

    expect(onTextDelta.mock.calls.map(([text]) => text).join("")).toBe(markdown);
    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(result.markdown).toBe(markdown);
  });

  it("rejects model output that does not cite its claimed source", async () => {
    const knowledge = { search: jest.fn().mockResolvedValue([candidate]) };
    const provider = { generateObject: jest.fn().mockResolvedValue({
      value: { answerable: true, markdown: "Bạn cứ gửi yêu cầu.", usedSourceIds: [1], suggestedQuestions: [] },
      model: "test-model",
      inputTokens: 100,
      outputTokens: 20,
      estimatedCostUsd: null
    }) };
    const service = new CeoHrAnswerService(knowledge as never, provider as never, disabledCache as never);
    const result = await service.answer(actor, "Tôi cần xin nghỉ phép như thế nào?", []);
    expect(result.answerability.status).toBe("UNANSWERED");
    expect(result.answerability.reasonCode).toBe("CITATION_VALIDATION_FAILED");
    expect(result.sources).toEqual([]);
  });
});
