import { Injectable } from "@nestjs/common";
import { EtsyDataDomain } from "./etsy-data.types";

export interface EtsyRoute {
  kind: "knowledge" | "data";
  domain?: EtsyDataDomain;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class EtsyQuestionRouterService {
  route(question: string, now = new Date()): EtsyRoute {
    const normalized = this.normalize(question);
    const domain = this.domain(normalized);
    if (!domain) return { kind: "knowledge" };
    return { kind: "data", domain, ...this.dateRange(normalized, now) };
  }

  private domain(question: string): EtsyDataDomain | undefined {
    if (/\b(order id|ma don|don hang|trang thai don|bao nhieu don|so don)\b/.test(question)) return "orders";
    if (/\b(fulfill|fulfillment|xuong|ship|tracking|chi phi fulfill|vendor)\b/.test(question)) return "fulfillment";
    if (/\b(refund|case|support|message|khieu nai|hoan tien|tien hoan)\b/.test(question)) return "support";
    if (/\b(product|san pham|sku|listing|mau nao|ban chay|top product)\b/.test(question) && !/\b(quy trinh|cach|huong dan|duyet)\b/.test(question)) return "products";
    if (/\b(tien|doanh thu|doanh so|net|loi nhuan|lai|fund|chi phi|phi|payout|paid|quyet toan)\b/.test(question)) return "finance";
    if (/\b(shop|store|cua hang)\b/.test(question)) return "shops";
    if (/\b(team|seller|nhan vien|thanh vien|bang xep hang|top seller|hieu suat)\b/.test(question)) return "team";
    if (/\b(tong quan|bao cao|tinh hinh|bao nhieu item|hom nay co|du lieu den|cap nhat den)\b/.test(question)) return "overview";
    return undefined;
  }

  private dateRange(question: string, now: Date): { startDate: string; endDate: string } {
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const today = new Date(`${local}T00:00:00Z`);
    let start = new Date(today); let end = new Date(today);
    if (/hom qua/.test(question)) { start.setUTCDate(start.getUTCDate() - 1); end = new Date(start); }
    else if (/tuan truoc/.test(question)) { const day = today.getUTCDay() || 7; end.setUTCDate(end.getUTCDate() - day); start = new Date(end); start.setUTCDate(start.getUTCDate() - 6); }
    else if (/7 ngay|tuan nay|trong tuan/.test(question)) start.setUTCDate(start.getUTCDate() - 6);
    else if (/30 ngay/.test(question)) start.setUTCDate(start.getUTCDate() - 29);
    else if (/nam nay/.test(question)) start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    else if (/thang nay/.test(question)) start.setUTCDate(1);
    else if (/thang truoc/.test(question)) { end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)); start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); }
    const namedMonth = question.match(/\bthang\s+(1[0-2]|0?[1-9])(?:\s*(?:\/|nam\s+)(20\d{2}))?\b/);
    if (namedMonth && !/thang (?:nay|truoc)/.test(question)) { const month = Number(namedMonth[1]); const year = namedMonth[2] ? Number(namedMonth[2]) : today.getUTCFullYear(); start = new Date(Date.UTC(year, month - 1, 1)); end = new Date(Date.UTC(year, month, 0)); }
    const quarter = question.match(/\bquy\s*([1-4])(?:\s*(?:\/|nam\s+)(20\d{2}))?\b/);
    if (quarter) { const value = Number(quarter[1]); const year = quarter[2] ? Number(quarter[2]) : today.getUTCFullYear(); start = new Date(Date.UTC(year, (value - 1) * 3, 1)); end = new Date(Date.UTC(year, value * 3, 0)); }
    const explicit = question.match(/(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)/g);
    if (explicit?.length) { const dates = explicit.map((value) => { const [year, month, day] = value.split(/[-\/]/).map(Number); return new Date(Date.UTC(year, month - 1, day)); }).sort((a,b) => a.getTime() - b.getTime()); start = dates[0]; end = dates.at(-1)!; }
    return { startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10) };
  }

  private normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
}
