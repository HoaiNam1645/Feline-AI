import { Injectable } from "@nestjs/common";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { assertNumericallyGrounded, unsupportedNumericClaims } from "../agents/grounding-validator";
import { AccessProfile } from "../auth/access-control";
import { PrismaService } from "../database/prisma.service";
import { TiktokScopeService } from "./tiktok-scope.service";
import { TiktokQuestionRouterService, TiktokRoute } from "./tiktok-question-router.service";
import { TiktokToolExecutorService } from "./tiktok-tool-executor.service";
import { TiktokDataDomain, TiktokToolOutput } from "./tiktok-data.types";

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
    private readonly provider: AnthropicStructuredProvider,
    private readonly prisma: PrismaService
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
    const rawToolOutput = await this.tools.execute(agentRunId, TOOL_BY_DOMAIN[route.domain], {
      startDate: route.startDate,
      endDate: route.endDate,
      timeZone: "America/Los_Angeles",
      scope,
      question
    });
    const accessScope = await this.accessScope(scope);
    const toolOutput: TiktokToolOutput = { ...rawToolOutput, accessScope };
    const result = await this.provider.generateObject<GeneratedDataAnswer>({
      system: [
        "Bạn là TikTok AI của Feline, chuyên phân tích dữ liệu vận hành phòng Sell TikTok.",
        "Chỉ sử dụng JSON từ tool. Không tự thêm số liệu, công thức, trạng thái hoặc nguyên nhân.",
        "Phân biệt rõ gross order value, estimated revenue, statement settlement, paid amount, stored net profit và operational contribution.",
        "Nếu dữ liệu có qualityWarnings, phải nêu cảnh báo trong câu trả lời.",
        "Nếu accessScope.unrestricted=false, phải nói rõ đây chỉ là số liệu trong accessScope.labels; không được gọi là toàn bộ TikTok hoặc toàn bộ phòng.",
        "Nếu câu hỏi nêu rõ team, seller hoặc store nhưng JSON không có đối tượng đó, phải nói không tìm thấy trong phạm vi được cấp; không được thay bằng số tổng của phạm vi.",
        "Khi hỏi một cá nhân, chỉ cộng các dòng bySellerStore có sellerName khớp; khi hỏi một team hoặc store cũng áp dụng nguyên tắc tương tự.",
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
      signal
    });
    const generatedMarkdown = result.value.markdown.trim();
    // Identifiers such as G9B are allowed when they came from the user's question.
    const unsupported = unsupportedNumericClaims(generatedMarkdown, { question, toolOutput });
    const groundedMarkdown = unsupported.length
      ? this.withQualityWarnings(this.deterministicAnswer(question, route, toolOutput), toolOutput.source.qualityWarnings)
      : generatedMarkdown;
    const markdown = this.withScopeNotice(groundedMarkdown, accessScope);
    // Model output must only repeat grounded numbers. Deterministic fallbacks
    // may contain verified sums and row counts derived directly from tool rows.
    if (!unsupported.length) assertNumericallyGrounded(markdown, { question, toolOutput });
    this.emit(markdown, onTextDelta);
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
      answerability: {
        status: "ANSWERED" as const,
        reasonCode: unsupported.length ? "DETERMINISTIC_TIKTOK_DATA_FALLBACK" : "GROUNDED_TIKTOK_DATA",
        reason: unsupported.length ? `Đã thay câu trả lời có số chưa được xác minh: ${unsupported.join(", ")}` : null
      },
      usage: { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCostUsd: result.estimatedCostUsd }
    };
  }

  private async accessScope(scope: { unrestricted: boolean; teamIds: number[]; storeIds: number[]; userIds: number[] }) {
    if (scope.unrestricted) return { unrestricted: true, labels: [] };
    const ids = [
      ...scope.teamIds.map((id) => `tiktok.team:${id}`),
      ...scope.storeIds.map((id) => `tiktok.store:${id}`),
      ...scope.userIds.map((id) => `tiktok.user:${id}`)
    ];
    const rows = ids.length
      ? await this.prisma.dataScope.findMany({ where: { id: { in: ids }, agentId: "tiktok-ai", isActive: true }, select: { id: true, name: true } })
      : [];
    const names = new Map(rows.map((row) => [row.id, row.name]));
    return { unrestricted: false, labels: ids.map((id) => names.get(id) || id) };
  }

  private withScopeNotice(markdown: string, accessScope: { unrestricted: boolean; labels: string[] }): string {
    if (accessScope.unrestricted) return markdown;
    const label = accessScope.labels.length ? accessScope.labels.join(", ") : "phạm vi dữ liệu được cấp";
    return `> **Phạm vi quyền:** ${label}. Số liệu không đại diện toàn bộ hệ thống TikTok.\n\n${markdown}`;
  }

  private withQualityWarnings(markdown: string, warnings: string[]): string {
    if (!warnings.length) return markdown;
    return `${markdown}\n\n**Cảnh báo chất lượng dữ liệu:**\n${warnings.map((warning) => `- ${warning}`).join("\n")}`;
  }

  private deterministicAnswer(question: string, route: TiktokRoute, output: TiktokToolOutput): string {
    if (route.domain === "team") return this.teamAnswer(question, output);
    if (route.domain === "finance") return this.financeAnswer(question, output);
    const facts = this.numericFacts(output.data).slice(0, 12);
    const range = output.range.startDate === output.range.endDate
      ? output.range.startDate
      : `${output.range.startDate} đến ${output.range.endDate}`;
    if (!facts.length) {
      return `Chưa có số liệu phù hợp trong phạm vi **${range}** để trả lời chắc chắn câu hỏi này.`;
    }
    const rows = facts.map((fact) => `- **${this.factLabel(fact.key)}:** ${this.formatNumber(fact.value)}`);
    return [`**Số liệu đã xác minh trong phạm vi ${range}:**`, "", ...rows].join("\n");
  }

  private financeAnswer(question: string, output: TiktokToolOutput): string {
    const data = output.data as Record<string, unknown> & { bySellerStore?: Array<Record<string, unknown>> };
    const normalizedQuestion = this.normalize(question);
    const rows = data.bySellerStore || [];
    const matching = rows.filter((row) => [row.sellerName, row.storeName, row.teamName, row.teamCode]
      .some((value) => value && normalizedQuestion.includes(this.normalize(String(value)))));
    const range = output.range.startDate === output.range.endDate
      ? output.range.startDate
      : `${output.range.startDate} đến ${output.range.endDate}`;
    if (matching.length) {
      const total = (field: string) => matching.reduce((sum, row) => sum + Number(row[field] || 0), 0);
      const subject = String(matching[0].sellerName || matching[0].storeName || matching[0].teamName || "Đối tượng được hỏi");
      return [
        `**${subject} trong phạm vi ${range}:**`, "",
        `- Paid amount: **${this.formatNumber(total("paidAmount"))} USD**`,
        `- Statement settlement: **${this.formatNumber(total("statementSettlement"))} USD**`,
        `- Statement fee: **${this.formatNumber(total("statementFee"))} USD**`,
        `- Net sales trong snapshot: **${this.formatNumber(total("snapshotNetSales"))} USD**`, "",
        `Số liệu gồm **${matching.length} store** trong phạm vi tài khoản được cấp.`
      ].join("\n");
    }
    const asksNamedEntity = /\b(team|seller|nhan vien|store|shop|cua)\b/.test(normalizedQuestion)
      || rows.some((row) => [row.sellerName, row.storeName, row.teamName].some((value) => value && normalizedQuestion.includes(this.normalize(String(value)).split(" ").at(-1) || "")));
    if (asksNamedEntity && rows.length) {
      return `Không tìm thấy đối tượng được hỏi trong dữ liệu **${range}** thuộc phạm vi tài khoản hiện tại. Mình không dùng số tổng của team/phòng để thay cho số cá nhân.`;
    }
    const facts = this.numericFacts(data).slice(0, 12);
    if (!facts.length) return `Chưa có số liệu tài chính phù hợp trong phạm vi **${range}**.`;
    return [`**Số liệu tài chính đã xác minh trong phạm vi ${range}:**`, "", ...facts.map((fact) => `- **${this.factLabel(fact.key)}:** ${this.formatNumber(fact.value)}`)].join("\n");
  }

  private teamAnswer(question: string, output: TiktokToolOutput): string {
    const data = output.data as {
      summary?: TeamSummary;
      byTeam?: TeamSummary[];
      mode?: string;
      keyword?: string | null;
      found?: boolean;
      teams?: Array<{
        teamName: string; teamCode: string | null; manager: { name: string | null };
        activeMembers: Array<{ name: string; position?: string | null; isManager?: boolean }>;
        inactiveMembers: Array<{ name: string }>;
      }>;
    };
    if (data.mode === "members") {
      if (!data.found || !data.teams?.length) {
        return `Không tìm thấy team **${data.keyword || "được hỏi"}** trong phạm vi tài khoản hiện tại.`;
      }
      return data.teams.map((team) => [
        `**Team ${team.teamName} có ${team.activeMembers.length} thành viên đang hoạt động.**`,
        team.manager.name ? `- Quản lý: **${team.manager.name}**` : "- Chưa có thông tin quản lý.",
        ...team.activeMembers.map((member) => `- ${member.name}${member.position ? ` — ${member.position}` : ""}${member.isManager ? " (Manager)" : ""}`),
        ...(team.inactiveMembers.length ? [`- Thành viên ngừng hoạt động: **${team.inactiveMembers.length}**`] : [])
      ].join("\n")).join("\n\n");
    }
    const normalizedQuestion = this.normalize(question);
    const team = data.byTeam?.find((item) => {
      const name = this.normalize(item.teamName || "");
      const code = this.normalize(item.teamCode || "");
      const compactName = name.replace(/\bteam\b/g, " ").replace(/\s+/g, " ").trim();
      return Boolean(
        (name && normalizedQuestion.includes(name))
        || (compactName && normalizedQuestion.includes(compactName))
        || (code && normalizedQuestion.includes(code))
      );
    });
    const summary = team || data.summary;
    const range = output.range.startDate === output.range.endDate
      ? output.range.startDate
      : `${output.range.startDate} đến ${output.range.endDate}`;
    if (!summary) return `Chưa có dữ liệu team trong phạm vi **${range}**.`;
    const label = team ? `Team ${team.teamName?.replace(/\s+Team$/i, "")}` : "Các team trong phạm vi được cấp";
    return [
      `**${label} có ${this.formatNumber(summary.orders)} đơn hàng trong phạm vi ${range}.**`,
      "",
      `- Số lượng sản phẩm: **${this.formatNumber(summary.items)}**`,
      `- Seller có phát sinh đơn: **${this.formatNumber(summary.sellers)}**`,
      `- Doanh thu ước tính: **${this.formatNumber(summary.estimatedRevenue)} USD**`,
      "",
      "Dữ liệu được tính theo múi giờ Los Angeles."
    ].join("\n");
  }

  private numericFacts(value: unknown, prefix = ""): Array<{ key: string; value: number }> {
    if (typeof value === "number" && Number.isFinite(value)) {
      return prefix && !/(^|\.)(?:.*Ids?|teamId|sellerId|storeId|userId)$/i.test(prefix)
        ? [{ key: prefix, value }]
        : [];
    }
    if (Array.isArray(value)) return value.slice(0, 5).flatMap((item, index) => this.numericFacts(item, `${prefix}.${index + 1}`));
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([key, item]) => this.numericFacts(item, prefix ? `${prefix}.${key}` : key));
  }

  private factLabel(key: string): string {
    const raw = key.split(".").filter((item) => !/^\d+$/.test(item)).at(-1) || key;
    const labels: Record<string, string> = {
      orders: "Đơn hàng", items: "Sản phẩm", itemLines: "Dòng sản phẩm",
      grossOrderValue: "Tổng giá trị đơn", estimatedRevenue: "Doanh thu ước tính",
      storedNetProfit: "Lợi nhuận đang lưu", fulfillmentCost: "Chi phí fulfillment",
      refundAmount: "Tiền hoàn", operationalContributionBeforeAds: "Đóng góp trước quảng cáo",
      operationalContribution: "Đóng góp vận hành", pending: "Đang chờ",
      onHold: "Tạm giữ", fulfilled: "Đã hoàn thành", cancelled: "Đã hủy",
      missingCostOrders: "Đơn thiếu chi phí", stores: "Store", sellers: "Seller",
      teams: "Team", adsSpend: "Chi phí quảng cáo", paidAmount: "Đã thanh toán"
    };
    return labels[raw] || raw.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
  }

  private normalize(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  }

  private emit(markdown: string, onTextDelta?: (text: string) => void): void {
    if (!onTextDelta) return;
    (markdown.match(/.{1,80}(?:\s+|$)/gs) || [markdown]).forEach((part) => onTextDelta(part));
  }
}

interface TeamSummary {
  teamName?: string;
  teamCode?: string | null;
  sellers: number;
  orders: number;
  items: number;
  estimatedRevenue: number;
  fulfillmentCost: number;
  refundAmount: number;
  contributionBeforeAds: number;
}
