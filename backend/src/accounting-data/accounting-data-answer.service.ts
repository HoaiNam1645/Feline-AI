import { Injectable } from "@nestjs/common";
import { AgentToolCallStatus, Prisma } from "@prisma/client";
import { assertNumericallyGrounded, unsupportedNumericClaims } from "../agents/grounding-validator";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { PrismaService } from "../database/prisma.service";
import { AccountingDataPayload, AccountingRoute } from "./accounting-data.types";
import { AccountingQuestionRouterService } from "./accounting-question-router.service";
import { AccountingSourceService } from "./accounting-source.service";

interface GeneratedAnswer { markdown: string; suggestedQuestions: string[] }

@Injectable()
export class AccountingDataAnswerService {
  constructor(private readonly router: AccountingQuestionRouterService, private readonly source: AccountingSourceService, private readonly provider: AnthropicStructuredProvider, private readonly prisma: PrismaService) {}

  route(question: string): AccountingRoute { return this.router.route(question); }

  async answer(_actor: unknown, question: string, route: AccountingRoute, agentRunId: string, signal?: AbortSignal, onTextDelta?: (text: string) => void) {
    if (route.kind !== "data" || !route.domain || !route.startDate || !route.endDate) throw new Error("Accounting question was not routed to a data domain");
    const call = await this.prisma.agentToolCall.create({ data: { agentRunId, toolId: `accounting.${route.domain}.get`, input: { startDate: route.startDate, endDate: route.endDate, query: route.query, question } as Prisma.InputJsonValue } });
    let payload: AccountingDataPayload;
    try {
      payload = await this.source.get(route.domain, route.startDate, route.endDate, route.query);
      await this.prisma.agentToolCall.update({ where: { id: call.id }, data: { status: AgentToolCallStatus.COMPLETED, output: payload as unknown as Prisma.InputJsonValue, completedAt: new Date() } });
    } catch (error) {
      await this.prisma.agentToolCall.update({ where: { id: call.id }, data: { status: AgentToolCallStatus.FAILED, error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown accounting tool error", completedAt: new Date() } });
      throw error;
    }
    const toolOutput = { domain: route.domain, range: { startDate: route.startDate, endDate: route.endDate }, data: payload, source: payload.source };
    const result = await this.provider.generateObject<GeneratedAnswer>({
      system: [
        "Bạn là Kế toán AI của Feline, chuyên phân tích dữ liệu tài chính nội bộ.",
        "Chỉ sử dụng JSON chỉ đọc được cung cấp; không tự thêm số liệu, không suy đoán giao dịch và không đề xuất sửa dữ liệu trực tiếp.",
        "Phân biệt rõ khoản thu, khoản chi, dòng tiền ròng, yêu cầu mua hàng, công nợ phải thu, tài khoản thanh toán và quy đổi tiền.",
        "Không tiết lộ số tài khoản đầy đủ, token, cấu hình hoặc dữ liệu đăng nhập.",
        "Nêu rõ khoảng ngày, múi giờ và thời điểm dữ liệu cập nhật.",
        "Trả lời tiếng Việt bằng Markdown; kết luận trực tiếp trước, sau đó mới giải thích số liệu và điểm cần kiểm tra."
      ].join("\n"),
      user: `Câu hỏi: ${question}\n\nDữ liệu kế toán chỉ đọc:\n${JSON.stringify(toolOutput)}`,
      toolName: "submit_accounting_data_answer",
      toolDescription: "Trả về câu trả lời dữ liệu kế toán có căn cứ.",
      inputSchema: { type: "object", additionalProperties: false, required: ["markdown", "suggestedQuestions"], properties: { markdown: { type: "string" }, suggestedQuestions: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 3 } } },
      maxOutputTokens: 1400,
      signal
    });
    const generated = result.value.markdown.trim();
    const unsupported = unsupportedNumericClaims(generated, { question, toolOutput });
    const markdown = unsupported.length ? this.fallback(route, payload) : generated;
    if (!unsupported.length) assertNumericallyGrounded(markdown, { question, toolOutput });
    this.emit(markdown, onTextDelta);
    return {
      markdown,
      sources: [{ label: `Dữ liệu ${route.domain} Kế toán`, reportDate: `${route.startDate} - ${route.endDate}`, generatedAtUtc: payload.report.generatedAt, dataUpdatedAtUtc: payload.source.dataUpdatedAt, access: "read-only", timeZone: payload.report.timeZone }],
      suggestedQuestions: (result.value.suggestedQuestions || []).map((item) => item.trim()).filter(Boolean).slice(0, 3),
      answerability: { status: "ANSWERED" as const, reasonCode: unsupported.length ? "DETERMINISTIC_ACCOUNTING_DATA_FALLBACK" : "GROUNDED_ACCOUNTING_DATA", reason: unsupported.length ? `Đã loại số chưa được xác minh: ${unsupported.join(", ")}` : null },
      usage: { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCostUsd: result.estimatedCostUsd }
    };
  }

  private fallback(route: AccountingRoute, payload: AccountingDataPayload) {
    const range = route.startDate === route.endDate ? route.startDate : `${route.startDate} đến ${route.endDate}`;
    if (route.domain === "overview" && payload.summary) {
      const value = payload.summary;
      return [`**Tổng quan tài chính từ ${range}:**`, "", `- Tổng thu: **${this.money(value.income)}**`, `- Tổng chi: **${this.money(value.expense)}**`, `- Dòng tiền ròng: **${this.money(value.netCashFlow)}**`, `- Giao dịch: **${value.transactions || 0}**`, `- Công nợ chưa thu: **${this.money(value.outstandingReceivables)}**`].join("\n");
    }
    if (route.domain === "transactions" && payload.summary) {
      return [
        `**Thu chi từ ${range}:**`, "",
        `- Tổng thu: **${this.money(payload.summary.income)}**`,
        `- Tổng chi: **${this.money(payload.summary.expense)}**`,
        `- Dòng tiền ròng: **${this.money(payload.summary.netCashFlow)}**`,
        `- Số giao dịch: **${payload.summary.count || payload.transactions?.length || 0}**`
      ].join("\n");
    }
    if (route.domain === "purchases") {
      const rows = payload.purchases || [];
      if (!rows.length) return `Chưa có yêu cầu mua hàng phù hợp trong phạm vi **${range}**.`;
      const statusCounts = new Map<string, number>();
      let total = 0;
      for (const row of rows) {
        const status = this.text(row.status, "Chưa xác định");
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
        total += this.number(row.expectedAmount);
      }
      const statuses = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([status, count]) => `- ${status}: **${count} yêu cầu**`).join("\n");
      return [`**Yêu cầu mua hàng từ ${range}:**`, "", `- Tổng số: **${rows.length} yêu cầu**`, `- Tổng giá trị dự kiến: **${this.money(total)}**`, statuses].join("\n");
    }
    if (route.domain === "accounts") {
      const rows = [...(payload.accounts || [])].sort((a, b) => this.number(b.expense) - this.number(a.expense));
      if (!rows.length) return `Chưa có tài khoản thanh toán hoạt động trong phạm vi **${range}**.`;
      const details = rows.slice(0, 5).map((row, index) => `${index + 1}. **${this.text(row.accountName, "Tài khoản")}** (${this.text(row.bankName, "Chưa xác định ngân hàng")}): chi ${this.money(this.number(row.expense))}, thu ${this.money(this.number(row.income))}, biến động ròng ${this.money(this.number(row.netMovement))}.`);
      return [`**Dòng tiền theo tài khoản từ ${range}:**`, "", ...details].join("\n");
    }
    if (route.domain === "receivables") {
      const rows = [...(payload.receivables || [])].sort((a, b) => this.number(b.outstandingVnd) - this.number(a.outstandingVnd));
      if (!rows.length) return `Không có công nợ phải thu đang mở trong dữ liệu hiện tại.`;
      const outstanding = rows.reduce((total, row) => total + this.number(row.outstandingVnd), 0);
      const details = rows.slice(0, 5).map((row, index) => `${index + 1}. **${this.text(row.partyName, "Đối tác")}** — ${this.text(row.title, "Khoản phải thu")}: còn ${this.money(this.number(row.outstandingVnd))}.`);
      return [`**Công nợ phải thu hiện tại:**`, "", `- Tổng còn phải thu: **${this.money(outstanding)}**`, `- Số khoản: **${rows.length}**`, "", ...details].join("\n");
    }
    if (route.domain === "conversions") {
      const rows = payload.conversions || [];
      if (!rows.length) return `Chưa có lần quy đổi tiền phù hợp trong dữ liệu hiện tại.`;
      const amountUsd = rows.reduce((total, row) => total + this.number(row.amountUsd), 0);
      const amountVnd = rows.reduce((total, row) => total + this.number(row.amountVnd), 0);
      const recent = rows.slice(0, 5).map((row, index) => `${index + 1}. **${this.text(row.status, "Chưa xác định")}** — ${this.usd(this.number(row.amountUsd))} / ${this.money(this.number(row.amountVnd))}.`);
      return [`**Quy đổi tiền trong dữ liệu hiện tại:**`, "", `- Số lượt: **${rows.length}**`, `- Tổng USD: **${this.usd(amountUsd)}**`, `- Tổng VND: **${this.money(amountVnd)}**`, "", ...recent].join("\n");
    }
    const rows = payload.transactions || payload.purchases || payload.accounts || payload.receivables || payload.conversions || [];
    if (!rows.length) return `Chưa có dữ liệu ${route.domain} phù hợp trong phạm vi **${range}**.`;
    return [`**Tìm thấy ${rows.length} bản ghi ${route.domain} trong phạm vi ${range}.**`, "", "Dữ liệu đã được lấy từ hệ thống kế toán ở chế độ chỉ đọc. Hãy hỏi cụ thể tên khoản mục, trạng thái hoặc đối tượng để mình phân tích chi tiết hơn."].join("\n");
  }

  private money(value: number | undefined) { return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0)} VND`; }
  private usd(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }
  private number(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
  private text(value: unknown, fallback: string) { const text = String(value ?? "").trim(); return text || fallback; }
  private emit(markdown: string, onTextDelta?: (text: string) => void) { if (onTextDelta) (markdown.match(/.{1,80}(?:\s+|$)/gs) || [markdown]).forEach((part) => onTextDelta(part)); }
}
