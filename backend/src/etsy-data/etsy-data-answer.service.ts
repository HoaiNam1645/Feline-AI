import { Injectable } from "@nestjs/common";
import { AgentToolCallStatus, Prisma } from "@prisma/client";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { assertNumericallyGrounded, unsupportedNumericClaims } from "../agents/grounding-validator";
import { AccessProfile } from "../auth/access-control";
import { PrismaService } from "../database/prisma.service";
import { EtsyDashboardData, EtsyDashboardFilters, EtsyDataDomain } from "./etsy-data.types";
import { EtsyQuestionRouterService, EtsyRoute } from "./etsy-question-router.service";
import { EtsyScopeService } from "./etsy-scope.service";
import { EtsySourceService } from "./etsy-source.service";

interface GeneratedAnswer { markdown: string; suggestedQuestions: string[] }

@Injectable()
export class EtsyDataAnswerService {
  constructor(
    private readonly router: EtsyQuestionRouterService,
    private readonly scopes: EtsyScopeService,
    private readonly source: EtsySourceService,
    private readonly provider: AnthropicStructuredProvider,
    private readonly prisma: PrismaService
  ) {}

  route(question: string): EtsyRoute { return this.router.route(question); }

  async answer(actor: { role: "ADMIN" | "MANAGER" | "USER"; access: AccessProfile }, question: string, route: EtsyRoute, agentRunId: string, signal?: AbortSignal, onTextDelta?: (text: string) => void) {
    if (route.kind !== "data" || !route.domain || !route.startDate || !route.endDate) throw new Error("Etsy data question was not routed to a data domain");
    const filters = this.scopes.fromActor(actor as never, { sellerTeamIds: [], shopIds: [], sellerIds: [] });
    const call = await this.prisma.agentToolCall.create({ data: { agentRunId, toolId: `etsy.${route.domain}.get`, input: { startDate: route.startDate, endDate: route.endDate, filters, question } as unknown as Prisma.InputJsonValue } });
    let dashboard: EtsyDashboardData;
    try {
      dashboard = await this.source.dashboard(route.startDate, route.endDate, filters);
      await this.prisma.agentToolCall.update({ where: { id: call.id }, data: { status: AgentToolCallStatus.COMPLETED, output: this.domainData(route.domain, dashboard) as Prisma.InputJsonValue, completedAt: new Date() } });
    } catch (error) {
      await this.prisma.agentToolCall.update({ where: { id: call.id }, data: { status: AgentToolCallStatus.FAILED, error: error instanceof Error ? error.message.slice(0,1000) : "Unknown Etsy tool error", completedAt: new Date() } });
      throw error;
    }
    const accessScope = this.accessScope(actor, filters, dashboard);
    const toolOutput = { domain: route.domain, range: { startDate: route.startDate, endDate: route.endDate, timeZone: dashboard.report.timeZone }, accessScope, data: this.domainData(route.domain, dashboard), source: dashboard.source };
    const result = await this.provider.generateObject<GeneratedAnswer>({
      system: [
        "Bạn là Etsy AI của Feline, chuyên phân tích dữ liệu vận hành phòng Sell Etsy.",
        "Chỉ sử dụng JSON đã được phân quyền. Không tự thêm số liệu hoặc đối tượng.",
        "Nếu accessScope.unrestricted=false, phải nói rõ câu trả lời chỉ thuộc accessScope.labels; không được gọi là toàn bộ Etsy hoặc toàn bộ phòng.",
        "Nếu người dùng hỏi rõ team, seller, shop hoặc sản phẩm nhưng JSON không có đối tượng đó, nói không tìm thấy trong phạm vi được cấp; tuyệt đối không thay bằng số tổng.",
        "Không tiết lộ email, thông tin khách hàng, token hoặc cấu hình hệ thống.",
        "Phân biệt gross booked value, Etsy net, fulfillment cost, design cost, refund và operational profit.",
        "Trong topProducts, quantity là số lượng sản phẩm/item bán ra, không phải số đơn hàng.",
        "Nêu rõ khoảng ngày, múi giờ và thời điểm dữ liệu cập nhật.",
        "Trả lời tiếng Việt bằng Markdown, kết luận trực tiếp trước rồi mới liệt kê số liệu."
      ].join("\n"),
      user: `Câu hỏi: ${question}\n\nDữ liệu Etsy đã được phân quyền:\n${JSON.stringify(toolOutput)}`,
      toolName: "submit_etsy_data_answer",
      toolDescription: "Trả về câu trả lời dữ liệu Etsy có căn cứ.",
      inputSchema: { type: "object", additionalProperties: false, required: ["markdown", "suggestedQuestions"], properties: { markdown: { type: "string" }, suggestedQuestions: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 3 } } },
      maxOutputTokens: 1400,
      signal
    });
    const generated = result.value.markdown.trim();
    const unsupported = unsupportedNumericClaims(generated, { question, toolOutput });
    const grounded = unsupported.length ? this.fallback(route.domain, route, toolOutput.data, question, accessScope) : generated;
    const markdown = this.withScopeNotice(grounded, accessScope);
    if (!unsupported.length) assertNumericallyGrounded(markdown, { question, toolOutput });
    this.emit(markdown, onTextDelta);
    return {
      markdown,
      sources: [{ label: `Dữ liệu ${route.domain} Etsy`, reportDate: `${route.startDate} - ${route.endDate}`, generatedAtUtc: dashboard.report.generatedAt, dataUpdatedAtUtc: dashboard.source.dataUpdatedAt || dashboard.report.generatedAt, access: "read-only", timeZone: dashboard.report.timeZone }],
      suggestedQuestions: (result.value.suggestedQuestions || []).map((item) => item.trim()).filter(Boolean).slice(0,3),
      answerability: { status: "ANSWERED" as const, reasonCode: unsupported.length ? "DETERMINISTIC_ETSY_DATA_FALLBACK" : "GROUNDED_ETSY_DATA", reason: unsupported.length ? `Đã loại số chưa được xác minh: ${unsupported.join(", ")}` : null },
      usage: { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCostUsd: result.estimatedCostUsd }
    };
  }

  private domainData(domain: EtsyDataDomain, data: EtsyDashboardData): unknown {
    const common = { report: data.report, source: data.source, quality: data.quality };
    if (domain === "overview") return { ...common, summary: data.summary, statuses: data.statuses, trend: data.trend };
    if (domain === "orders") return { ...common, summary: { orders: data.summary.orders, items: data.summary.items }, statuses: data.statuses, trend: data.trend };
    if (domain === "finance") return { ...common, summary: data.summary, sellerTeams: data.sellerTeams, shops: data.shops, sellers: data.sellers.map(({ email: _email, ...seller }) => seller) };
    if (domain === "team") return {
      ...common,
      filters: {
        sellerTeams: data.filters.sellerTeams,
        sellers: data.filters.sellers.map(({ email: _email, ...seller }) => seller)
      },
      sellerTeams: data.sellerTeams,
      sellers: data.sellers.map(({ email: _email, ...seller }) => seller)
    };
    if (domain === "shops") return { ...common, filters: { shops: data.filters.shops }, shops: data.shops };
    if (domain === "products") return { ...common, topProducts: data.topProducts };
    if (domain === "fulfillment") return { ...common, fulfillmentCost: data.summary.fulfillmentCost, sellers: data.sellers.map(({ id, name, teamName, fulfillmentCost }) => ({ id, name, teamName, fulfillmentCost })) };
    return { ...common, refundAmount: data.summary.refundAmount, sellers: data.sellers.map(({ id, name, teamName, refundAmount }) => ({ id, name, teamName, refundAmount })) };
  }

  private fallback(domain: EtsyDataDomain, route: EtsyRoute, data: unknown, question: string, scope: { unrestricted: boolean; labels: string[] }): string {
    if (this.namedTeamOutsideScope(question, scope)) {
      return "Không tìm thấy team được hỏi trong phạm vi dữ liệu Etsy hiện tại; mình không dùng số của team được cấp để thay thế.";
    }
    if (domain === "team") return this.teamFallback(route, data, question);
    if (domain === "finance") return this.financeFallback(route, data, question);
    if (domain === "fulfillment") return this.fulfillmentFallback(route, data, question);
    if (domain === "support") return this.supportFallback(route, data, question);
    if (domain === "products") return this.productsFallback(route, data);
    if (domain === "shops") return this.shopsFallback(route, data, question);
    if (domain === "orders" || domain === "overview") return this.summaryFallback(route, data);
    const range = route.startDate === route.endDate ? route.startDate : `${route.startDate} đến ${route.endDate}`;
    const facts = this.numericFacts(data).slice(0,12);
    if (!facts.length) return `Chưa có dữ liệu ${domain} phù hợp trong phạm vi **${range}**.`;
    return [`**Số liệu Etsy đã xác minh trong phạm vi ${range}:**`, "", ...facts.map((item) => `- **${item.key}:** ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(item.value)}`)].join("\n");
  }

  private fulfillmentFallback(route: EtsyRoute, value: unknown, question: string): string {
    const data = value as { fulfillmentCost?: number; sellers?: Array<{ name: string; teamName: string; fulfillmentCost: number }> };
    const normalized = this.normalize(question);
    const seller = data.sellers?.find((item) => normalized.includes(this.normalize(item.name)));
    if (seller) return `**Chi phí fulfillment của seller ${seller.name} trong phạm vi ${this.rangeLabel(route)} là ${this.formatNumber(seller.fulfillmentCost)} USD.**`;
    if (/\b(cao nhat|nhieu nhat|top)\b/.test(normalized)) {
      const top = [...(data.sellers || [])].sort((left, right) => right.fulfillmentCost - left.fulfillmentCost)[0];
      if (top) return `**Seller ${top.name} có chi phí fulfillment cao nhất: ${this.formatNumber(top.fulfillmentCost)} USD** trong phạm vi ${this.rangeLabel(route)}.`;
    }
    if (typeof data.fulfillmentCost === "number") {
      return `**Tổng chi phí fulfillment trong phạm vi được cấp từ ${this.rangeLabel(route)} là ${this.formatNumber(data.fulfillmentCost)} USD.**`;
    }
    return `Chưa có dữ liệu chi phí fulfillment trong phạm vi ${this.rangeLabel(route)}.`;
  }

  private supportFallback(route: EtsyRoute, value: unknown, question: string): string {
    const data = value as { refundAmount?: number; sellers?: Array<{ name: string; teamName: string; refundAmount: number }> };
    const normalized = this.normalize(question);
    const seller = data.sellers?.find((item) => normalized.includes(this.normalize(item.name)));
    if (seller) return `**Tiền hoàn của seller ${seller.name} trong phạm vi ${this.rangeLabel(route)} là ${this.formatNumber(seller.refundAmount)} USD.**`;
    if (/\b(cao nhat|nhieu nhat|top)\b/.test(normalized)) {
      const top = [...(data.sellers || [])].sort((left, right) => right.refundAmount - left.refundAmount)[0];
      if (top) return `**Seller ${top.name} có tiền hoàn cao nhất: ${this.formatNumber(top.refundAmount)} USD** trong phạm vi ${this.rangeLabel(route)}.`;
    }
    if (typeof data.refundAmount === "number") return `**Tổng tiền hoàn trong phạm vi được cấp từ ${this.rangeLabel(route)} là ${this.formatNumber(data.refundAmount)} USD.**`;
    return `Chưa có dữ liệu refund/support trong phạm vi ${this.rangeLabel(route)}.`;
  }

  private productsFallback(route: EtsyRoute, value: unknown): string {
    const data = value as { topProducts?: Array<{ name: string; shopName: string; quantity: number; grossBookedValue: number; net: number }> };
    const products = (data.topProducts || []).slice(0, 10);
    if (!products.length) return `Chưa có dữ liệu sản phẩm trong phạm vi ${this.rangeLabel(route)}.`;
    return [
      `**Sản phẩm bán chạy trong phạm vi ${this.rangeLabel(route)}:**`, "",
      ...products.map((item, index) => `${index + 1}. **${item.name}** — ${this.formatNumber(item.quantity)} sản phẩm — Shop ${item.shopName} — Net ${this.formatNumber(item.net)} USD`)
    ].join("\n");
  }

  private shopsFallback(route: EtsyRoute, value: unknown, question: string): string {
    const data = value as { shops?: Array<{ id: string; name: string; orders: number; items: number; net: number; profit: number }> };
    const normalized = this.normalize(question);
    const shop = data.shops?.find((item) => normalized.includes(this.normalize(item.name)));
    if (shop) return this.financeEntity(shop as unknown as Record<string, unknown>, `Shop ${shop.name}`, route);
    if (!data.shops?.length) return `Chưa có shop trong phạm vi ${this.rangeLabel(route)}.`;
    return [
      `**Có ${data.shops.length} shop trong phạm vi được cấp:**`, "",
      ...data.shops.map((item) => `- **${item.name}**: ${this.formatNumber(item.orders)} đơn, net ${this.formatNumber(item.net)} USD, lợi nhuận ${this.formatNumber(item.profit)} USD`)
    ].join("\n");
  }

  private summaryFallback(route: EtsyRoute, value: unknown): string {
    const data = value as { summary?: Record<string, unknown>; statuses?: Array<{ status: string; orders: number }> };
    const summary = data.summary || {};
    const rows: Array<[string, unknown, string]> = [
      ["Đơn hàng", summary.orders, ""], ["Sản phẩm", summary.items, ""],
      ["Gross booked value", summary.grossBookedValue, " USD"], ["Etsy net", summary.etsyNet, " USD"],
      ["Chi phí fulfillment", summary.fulfillmentCost, " USD"], ["Tiền hoàn", summary.refundAmount, " USD"],
      ["Lợi nhuận vận hành", summary.operationalProfit, " USD"]
    ];
    const available = rows.filter(([, value]) => typeof value === "number" && Number.isFinite(value));
    if (!available.length) return `Chưa có số liệu tổng hợp trong phạm vi ${this.rangeLabel(route)}.`;
    return [
      `**Tổng quan Etsy trong phạm vi ${this.rangeLabel(route)}:**`, "",
      ...available.map(([label, value, suffix]) => `- ${label}: **${this.formatNumber(Number(value))}${suffix}**`),
      ...(data.statuses?.length ? ["", "**Trạng thái đơn:**", ...data.statuses.map((item) => `- ${item.status}: **${this.formatNumber(item.orders)} đơn**`)] : [])
    ].join("\n");
  }

  private namedTeamOutsideScope(question: string, scope: { unrestricted: boolean; labels: string[] }): boolean {
    if (scope.unrestricted) return false;
    const normalized = this.normalize(question);
    if (!/\bteam\s+(?!nao\b)/.test(normalized)) return false;
    const allowedTeams = scope.labels.filter((label) => this.normalize(label).startsWith("team:"));
    return allowedTeams.length > 0 && !allowedTeams.some((label) => normalized.includes(this.normalize(label).replace(/^team:\s*/, "")));
  }

  private teamFallback(route: EtsyRoute, value: unknown, question: string): string {
    const data = value as {
      filters?: { sellerTeams?: Array<{ id: string; name: string }>; sellers?: Array<{ id: string; name: string; teamId: string | null }> };
      sellerTeams?: Array<{ id: string; name: string; members: number; orders: number; items: number; grossBookedValue: number; net: number; profit: number }>;
      sellers?: Array<{ id: string; name: string; teamId: string | null; teamName: string; orders: number; items: number; grossBookedValue: number; net: number; profit: number }>;
    };
    const normalized = this.normalize(question);
    const asksMembers = /\b(co nhung ai|thanh vien|danh sach|gom nhung ai)\b/.test(normalized);
    const team = data.filters?.sellerTeams?.find((item) => normalized.includes(this.normalize(item.name))) || data.filters?.sellerTeams?.[0];
    if (asksMembers && team) {
      const sellers = (data.filters?.sellers || []).filter((seller) => seller.teamId === team.id);
      if (!sellers.length) return `Chưa có danh sách seller của **Team ${team.name}** trong dữ liệu được cấp.`;
      const active = (data.sellers || []).filter((seller) => seller.teamId === team.id && seller.orders > 0).length;
      return [
        `**Team ${team.name} có ${sellers.length} seller trong danh mục được cấp.**`,
        "",
        ...sellers.map((seller) => `- ${seller.name}`),
        "",
        `Trong phạm vi ${this.rangeLabel(route)}, có **${active} seller phát sinh đơn**.`
      ].join("\n");
    }
    const teamMetric = data.sellerTeams?.find((item) => normalized.includes(this.normalize(item.name)));
    if (teamMetric) {
      return [
        `**Team ${teamMetric.name} trong phạm vi ${this.rangeLabel(route)}:**`, "",
        `- Đơn hàng: **${this.formatNumber(teamMetric.orders)}**`,
        `- Sản phẩm: **${this.formatNumber(teamMetric.items)}**`,
        `- Seller phát sinh đơn: **${this.formatNumber(teamMetric.members)}**`,
        `- Gross booked value: **${this.formatNumber(teamMetric.grossBookedValue)} USD**`,
        `- Etsy net: **${this.formatNumber(teamMetric.net)} USD**`,
        `- Lợi nhuận vận hành: **${this.formatNumber(teamMetric.profit)} USD**`
      ].join("\n");
    }
    const seller = data.sellers?.find((item) => normalized.includes(this.normalize(item.name)));
    if (seller) return this.financeEntity(seller, `Seller ${seller.name}`, route);
    return "Không tìm thấy team hoặc seller được hỏi trong phạm vi dữ liệu Etsy hiện tại.";
  }

  private financeFallback(route: EtsyRoute, value: unknown, question: string): string {
    const data = value as {
      sellerTeams?: Array<Record<string, unknown>>;
      shops?: Array<Record<string, unknown>>;
      sellers?: Array<Record<string, unknown>>;
      summary?: Record<string, unknown>;
    };
    const normalized = this.normalize(question);
    const asksRanking = /\b(cao nhat|thap nhat|nhieu nhat|it nhat|top|tot nhat)\b/.test(normalized);
    if (asksRanking) {
      const candidates = /\b(shop|store|cua hang)\b/.test(normalized)
        ? data.shops || []
        : /\b(seller|nhan vien)\b/.test(normalized)
          ? data.sellers || []
          : data.sellerTeams || [];
      const metric = /\b(loi nhuan|lai|profit)\b/.test(normalized)
        ? "profit"
        : /\b(refund|hoan tien|tien hoan)\b/.test(normalized)
          ? "refundAmount"
        : /\b(net|doanh thu)\b/.test(normalized)
          ? "net"
          : /\b(don|order)\b/.test(normalized)
            ? "orders"
            : "grossBookedValue";
      const direction = /\b(thap nhat|it nhat)\b/.test(normalized) ? 1 : -1;
      const ranked = [...candidates]
        .filter((item) => typeof item[metric] === "number" && Number.isFinite(item[metric]))
        .sort((left, right) => direction * (Number(left[metric]) - Number(right[metric])))[0];
      if (ranked) {
        const kind = candidates === data.shops ? "Shop" : candidates === data.sellers ? "Seller" : "Team";
        const name = String(ranked.name || "");
        const label = this.normalize(name).startsWith(this.normalize(kind)) ? name : `${kind} ${name}`;
        return this.financeEntity(ranked, label, route);
      }
      return `Chưa có dữ liệu phù hợp để xếp hạng trong phạm vi ${this.rangeLabel(route)}.`;
    }
    const groups = [
      ...(data.sellerTeams || []).map((item) => ({ item, label: `Team ${String(item.name || "")}` })),
      ...(data.sellers || []).map((item) => ({ item, label: `Seller ${String(item.name || "")}` })),
      ...(data.shops || []).map((item) => ({ item, label: `Shop ${String(item.name || "")}` }))
    ];
    const matched = groups.find(({ item }) => item.name && normalized.includes(this.normalize(String(item.name))));
    if (matched) return this.financeEntity(matched.item, matched.label, route);
    if (/\b(team|seller|shop|store|cua)\b/.test(normalized)) {
      return "Không tìm thấy đối tượng được hỏi trong phạm vi dữ liệu Etsy hiện tại; mình không dùng tổng toàn phòng để thay thế.";
    }
    return this.financeEntity(data.summary || {}, "Tổng số liệu trong phạm vi được cấp", route);
  }

  private financeEntity(item: Record<string, unknown>, label: string, route: EtsyRoute): string {
    const rows: Array<[string, unknown]> = [
      ["Đơn hàng", item.orders], ["Sản phẩm", item.items],
      ["Gross booked value", item.grossBookedValue], ["Etsy net", item.net ?? item.etsyNet],
      ["Chi phí fulfillment", item.fulfillmentCost], ["Chi phí design", item.designCost],
      ["Tiền hoàn", item.refundAmount], ["Lợi nhuận vận hành", item.profit ?? item.operationalProfit]
    ];
    const available = rows.filter(([, value]) => typeof value === "number" && Number.isFinite(value));
    if (!available.length) return `Chưa có số liệu tài chính phù hợp cho **${label}** trong phạm vi ${this.rangeLabel(route)}.`;
    return [`**${label} trong phạm vi ${this.rangeLabel(route)}:**`, "", ...available.map(([name, value]) => `- ${name}: **${this.formatNumber(Number(value))}${name === "Đơn hàng" || name === "Sản phẩm" ? "" : " USD"}**`)].join("\n");
  }

  private accessScope(actor: { role: "ADMIN" | "MANAGER" | "USER"; access: AccessProfile }, filters: EtsyDashboardFilters, dashboard: EtsyDashboardData) {
    if (actor.role === "ADMIN" || actor.access.platformAdmin) return { unrestricted: true, labels: [] as string[] };
    const labels = [
      ...dashboard.filters.sellerTeams.filter((item) => filters.sellerTeamIds.includes(item.id)).map((item) => `Team: ${item.name}`),
      ...dashboard.filters.shops.filter((item) => filters.shopIds.includes(item.id)).map((item) => `Shop: ${item.name}`),
      ...dashboard.filters.sellers.filter((item) => filters.sellerIds.includes(item.id)).map((item) => `Seller: ${item.name}`)
    ];
    return { unrestricted: false, labels };
  }

  private withScopeNotice(markdown: string, scope: { unrestricted: boolean; labels: string[] }): string {
    if (scope.unrestricted) return markdown;
    const label = scope.labels.length ? scope.labels.join(", ") : "phạm vi dữ liệu được cấp";
    return `> **Phạm vi quyền:** ${label}. Số liệu không đại diện toàn bộ phòng Etsy.\n\n${markdown}`;
  }

  private rangeLabel(route: EtsyRoute): string { return route.startDate === route.endDate ? route.startDate! : `${route.startDate} đến ${route.endDate}`; }
  private formatNumber(value: number): string { return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value); }
  private normalize(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }

  private numericFacts(value: unknown, prefix = ""): Array<{ key: string; value: number }> {
    if (typeof value === "number" && Number.isFinite(value)) return prefix && !/(^|\.)(?:.*Ids?|teamId|sellerId|shopId|id)$/i.test(prefix) ? [{ key: prefix, value }] : [];
    if (Array.isArray(value)) return value.slice(0,5).flatMap((item,index) => this.numericFacts(item, `${prefix}.${index + 1}`));
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([key,item]) => this.numericFacts(item, prefix ? `${prefix}.${key}` : key));
  }

  private emit(markdown: string, onTextDelta?: (text: string) => void) { if (onTextDelta) (markdown.match(/.{1,80}(?:\s+|$)/gs) || [markdown]).forEach((part) => onTextDelta(part)); }
}
