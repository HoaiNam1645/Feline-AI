import { Injectable } from "@nestjs/common";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { assertNumericallyGrounded } from "../agents/grounding-validator";
import { AccessProfile } from "../auth/access-control";
import { TiktokScopeService } from "./tiktok-scope.service";
import { TiktokQuestionRouterService, TiktokRoute } from "./tiktok-question-router.service";
import { TiktokToolExecutorService } from "./tiktok-tool-executor.service";
import { TiktokDataDomain } from "./tiktok-data.types";

interface GeneratedDataAnswer {
  markdown: string;
  suggestedQuestions: string[];
}

const TOOL_BY_DOMAIN: Record<TiktokDataDomain, string> = {
  overview: "tiktok.overview.get",
  orders: "tiktok.orders.search",
  finance: "tiktok.money.summary",
  team: "tiktok.team.performance",
  stores: "tiktok.stores.health",
  fulfillment: "tiktok.fulfillment.metrics",
  design: "tiktok.design.metrics"
};

@Injectable()
export class TiktokDataAnswerService {
  constructor(
    private readonly router: TiktokQuestionRouterService,
    private readonly scopes: TiktokScopeService,
    private readonly tools: TiktokToolExecutorService,
    private readonly provider: AnthropicStructuredProvider
  ) {}

  route(question: string): TiktokRoute { return this.router.route(question); }

  async answer(
    actor: { role: "ADMIN" | "MANAGER" | "USER"; access: AccessProfile },
    question: string,
    route: TiktokRoute,
    agentRunId: string,
    signal?: AbortSignal,
    onTextDelta?: (text: string) => void
  ) {
    if (route.kind !== "data" || !route.domain || !route.startDate || !route.endDate) {
      throw new Error("TikTok data question was not routed to a data domain");
    }
    const scope = this.scopes.fromActor(actor as never);
    this.scopes.assertDomain(scope, route.domain);
    const toolOutput = await this.tools.execute(agentRunId, TOOL_BY_DOMAIN[route.domain], {
      startDate: route.startDate,
      endDate: route.endDate,
      timeZone: "America/Los_Angeles",
      scope,
      question
    });
    let streamed = "";
    const result = await this.provider.generateObject<GeneratedDataAnswer>({
      system: [
        "Bạn là TikTok AI của Feline, chuyên phân tích dữ liệu vận hành phòng Sell TikTok.",
        "Chỉ sử dụng JSON từ tool. Không tự thêm số liệu, công thức, trạng thái hoặc nguyên nhân.",
        "Phân biệt rõ gross order value, estimated revenue, statement settlement, paid amount, stored net profit và operational contribution.",
        "Nếu dữ liệu có qualityWarnings, phải nêu cảnh báo trong câu trả lời.",
        "Luôn nói rõ phạm vi ngày theo America/Los_Angeles và thời điểm dữ liệu được cập nhật.",
        "Không hiển thị token, thông tin ngân hàng, proxy, địa chỉ, email hoặc số điện thoại khách hàng.",
        "Trả lời tiếng Việt bằng Markdown gọn, ưu tiên kết luận trước rồi đến số liệu và cảnh báo."
      ].join("\n"),
      user: `Câu hỏi: ${question}\n\nDữ liệu tool đã được phân quyền:\n${JSON.stringify(toolOutput)}`,
      toolName: "submit_tiktok_data_answer",
      toolDescription: "Trả về câu trả lời TikTok có căn cứ hoàn toàn từ dữ liệu tool.",
      inputSchema: {
        type: "object", additionalProperties: false,
        required: ["markdown", "suggestedQuestions"],
        properties: {
          markdown: { type: "string" },
          suggestedQuestions: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 3 }
        }
      },
      maxOutputTokens: 1200,
      signal,
      onTextDelta: onTextDelta ? (text) => { streamed += text; onTextDelta(text); } : undefined
    });
    const markdown = result.value.markdown.trim();
    // Identifiers such as G9B are allowed when they came from the user's question.
    assertNumericallyGrounded(markdown, { question, toolOutput });
    if (!streamed) onTextDelta?.(markdown);
    else if (markdown.startsWith(streamed)) onTextDelta?.(markdown.slice(streamed.length));
    return {
      markdown,
      sources: [{
        label: `Dữ liệu ${route.domain} TikTok`,
        reportDate: `${route.startDate} - ${route.endDate}`,
        generatedAtUtc: toolOutput.source.generatedAtUtc,
        dataUpdatedAtUtc: toolOutput.source.dataUpdatedAtUtc,
        tables: toolOutput.source.tables,
        access: toolOutput.source.access,
        timeZone: toolOutput.source.timeZone,
        qualityWarnings: toolOutput.source.qualityWarnings
      }],
      suggestedQuestions: (result.value.suggestedQuestions || []).map((item) => item.trim()).filter(Boolean).slice(0,3),
      answerability: { status: "ANSWERED" as const, reasonCode: "GROUNDED_TIKTOK_DATA", reason: null },
      usage: { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCostUsd: result.estimatedCostUsd }
    };
  }
}
