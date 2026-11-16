export interface BasicConversationReply {
  intent: "GREETING" | "THANKS" | "GOODBYE" | "IDENTITY" | "CAPABILITIES" | "WELLBEING";
  markdown: string;
  suggestedQuestions: string[];
}

interface BasicConversationAgent {
  name: string;
  domain: string;
  capabilitySummary: string;
  suggestions: string[];
}

function normalize(value: string): string {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function basicConversationReply(
  question: string,
  agent: BasicConversationAgent
): BasicConversationReply | null {
  const text = normalize(question);
  const short = text.split(" ").filter(Boolean).length <= 8;
  const suggestions = agent.suggestions.slice(0, 3);

  if (short && /^(hi|hello|hey|alo|chao|xin chao|chao ban|xin chao ban|chao buoi sang|chao buoi chieu|chao buoi toi)$/.test(text)) {
    return {
      intent: "GREETING",
      markdown: `Xin chào! Mình là **${agent.name}**. Mình có thể hỗ trợ bạn ${agent.capabilitySummary}. Bạn cần mình hỗ trợ nội dung nào?`,
      suggestedQuestions: suggestions
    };
  }
  if (short && /^(cam on|cam on ban|thanks|thank you|ok cam on|oke cam on)$/.test(text)) {
    return {
      intent: "THANKS",
      markdown: "Không có gì. Khi cần hỗ trợ thêm, bạn cứ nhắn mình nhé.",
      suggestedQuestions: suggestions
    };
  }
  if (short && /^(tam biet|bye|goodbye|hen gap lai|chao nhe)$/.test(text)) {
    return {
      intent: "GOODBYE",
      markdown: "Tạm biệt bạn. Chúc bạn làm việc hiệu quả!",
      suggestedQuestions: []
    };
  }
  if (short && /^(ban khoe khong|khoe khong|hom nay ban the nao)$/.test(text)) {
    return {
      intent: "WELLBEING",
      markdown: "Mình đang sẵn sàng hỗ trợ bạn. Hôm nay bạn muốn xử lý công việc nào?",
      suggestedQuestions: suggestions
    };
  }
  if (/^(ban la ai|day la ai|ban ten gi|gioi thieu ve ban|ban la tro ly gi)$/.test(text)) {
    return {
      intent: "IDENTITY",
      markdown: `Mình là **${agent.name}**, trợ lý phụ trách **${agent.domain}** trong hệ thống Feline AI.`,
      suggestedQuestions: suggestions
    };
  }
  if (/^(ban lam duoc gi|ban co the lam gi|ban ho tro gi|ban co the ho tro gi|toi co the hoi gi|giup duoc gi)$/.test(text)) {
    return {
      intent: "CAPABILITIES",
      markdown: `Mình có thể hỗ trợ bạn ${agent.capabilitySummary}. Với câu hỏi nghiệp vụ, mình sẽ trả lời từ tài liệu mà bạn được phép truy cập.`,
      suggestedQuestions: suggestions
    };
  }
  return null;
}

export function emitBasicConversation(
  markdown: string,
  onTextDelta?: (text: string) => void
): void {
  if (!onTextDelta) return;
  (markdown.match(/.{1,48}(?:\s+|$)/gs) || [markdown]).forEach((part) => onTextDelta(part));
}
