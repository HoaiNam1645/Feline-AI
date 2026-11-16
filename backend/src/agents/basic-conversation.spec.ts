import { basicConversationReply } from "./basic-conversation";

const agent = {
  name: "TikTok AI",
  domain: "phòng Sell TikTok",
  capabilitySummary: "tra cứu quy trình và tri thức Sell TikTok",
  suggestions: ["Quy trình duyệt nội dung TikTok như thế nào?"]
};

describe("basicConversationReply", () => {
  it.each(["hi", "Xin chào", "hello", "alo"])("handles greeting without knowledge: %s", (question) => {
    const result = basicConversationReply(question, agent);
    expect(result?.intent).toBe("GREETING");
    expect(result?.markdown).toContain("TikTok AI");
  });

  it("answers identity and capability questions", () => {
    expect(basicConversationReply("Bạn là ai?", agent)?.intent).toBe("IDENTITY");
    expect(basicConversationReply("Bạn làm được gì?", agent)?.intent).toBe("CAPABILITIES");
  });

  it("does not swallow business questions", () => {
    expect(basicConversationReply("Hiện tại quy trình duyệt video TikTok thế nào?", agent)).toBeNull();
    expect(basicConversationReply("Chào bạn, đơn TikTok này đang ở đâu?", agent)).toBeNull();
  });
});
