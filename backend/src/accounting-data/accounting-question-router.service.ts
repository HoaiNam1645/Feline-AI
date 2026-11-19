import { Injectable } from "@nestjs/common";
import { AccountingDataDomain, AccountingRoute } from "./accounting-data.types";

@Injectable()
export class AccountingQuestionRouterService {
  route(question: string, now = new Date()): AccountingRoute {
    const normalized = this.normalize(question);
    const domain = this.domain(normalized);
    if (!domain) return { kind: "knowledge" };
    return { kind: "data", domain, query: this.searchQuery(question, normalized), ...this.dateRange(normalized, now) };
  }

  private domain(question: string): AccountingDataDomain | undefined {
    if (/\b(cong no|phai thu|receivable|khach no|doi tac no|han thanh toan)\b/.test(question)) return "receivables";
    if (/\b(quy doi|doi tien|chuyen doi|usd|ty gia|currency conversion)\b/.test(question)) return "conversions";
    if (/\b(tai khoan|ngan hang|bank|vi ke toan|quy chung|so du|dong tien theo tai khoan)\b/.test(question)) return "accounts";
    if (/\b(yeu cau mua|mua hang|de nghi chi|yeu cau thanh toan|phe duyet|purchase|tam ung|hoan ung)\b/.test(question) && !/\b(quy trinh|cach|huong dan|quy dinh)\b/.test(question)) return "purchases";
    if (/\b(giao dich|thu chi|khoan thu|khoan chi|chi phi|doanh thu|hoa don|thu vao|chi ra|transaction|ma giao dich)\b/.test(question)) return "transactions";
    if (/\b(tong quan|bao cao|tinh hinh|dong tien|cash flow|loi nhuan|tai chinh|hom nay|thang nay|du lieu den)\b/.test(question)) return "overview";
    return undefined;
  }

  private dateRange(question: string, now: Date): { startDate: string; endDate: string } {
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const today = new Date(`${local}T00:00:00Z`);
    let start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)); let end = new Date(today);
    if (/hom nay|trong ngay/.test(question)) start = new Date(today);
    else if (/hom qua/.test(question)) { start = new Date(today); start.setUTCDate(start.getUTCDate() - 1); end = new Date(start); }
    else if (/tuan truoc/.test(question)) { const day = today.getUTCDay() || 7; end.setUTCDate(end.getUTCDate() - day); start = new Date(end); start.setUTCDate(start.getUTCDate() - 6); }
    else if (/7 ngay|tuan nay|trong tuan/.test(question)) { start = new Date(today); start.setUTCDate(start.getUTCDate() - 6); }
    else if (/30 ngay/.test(question)) { start = new Date(today); start.setUTCDate(start.getUTCDate() - 29); }
    else if (/gan day|moi nhat/.test(question)) { start = new Date(today); start.setUTCDate(start.getUTCDate() - 29); }
    else if (/nam nay/.test(question)) start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    else if (/thang nay/.test(question)) start.setUTCDate(1);
    else if (/thang truoc/.test(question)) { end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)); start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); }
    const month = question.match(/\bthang\s+(1[0-2]|0?[1-9])(?:\s*(?:\/|nam\s+)(20\d{2}))?\b/);
    if (month && !/thang (?:nay|truoc)/.test(question)) { const value = Number(month[1]); const year = month[2] ? Number(month[2]) : today.getUTCFullYear(); start = new Date(Date.UTC(year, value - 1, 1)); end = new Date(Date.UTC(year, value, 0)); }
    const explicit = question.match(/(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)/g);
    if (explicit?.length) { const dates = explicit.map((value) => { const [year, monthValue, day] = value.split(/[-\/]/).map(Number); return new Date(Date.UTC(year, monthValue - 1, day)); }).sort((a, b) => a.getTime() - b.getTime()); start = dates[0]; end = dates.at(-1)!; }
    const vietnameseDates = question.match(/\b([0-3]?\d)\/([01]?\d)\/(20\d{2})\b/g);
    if (vietnameseDates?.length) {
      const dates = vietnameseDates.map((value) => { const [day, monthValue, year] = value.split("/").map(Number); return new Date(Date.UTC(year, monthValue - 1, day)); }).sort((a, b) => a.getTime() - b.getTime());
      start = dates[0]; end = dates.at(-1)!;
    }
    const quarter = question.match(/\bquy\s*([1-4])(?:\s*nam\s*(20\d{2}))?\b/);
    if (quarter) {
      const quarterIndex = Number(quarter[1]) - 1;
      const year = quarter[2] ? Number(quarter[2]) : today.getUTCFullYear();
      start = new Date(Date.UTC(year, quarterIndex * 3, 1));
      end = new Date(Date.UTC(year, quarterIndex * 3 + 3, 0));
    }
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }

  private searchQuery(original: string, normalized: string): string | undefined {
    const quoted = original.match(/["“”']([^"“”']{2,80})["“”']/)?.[1]?.trim();
    if (quoted) return quoted;
    const reference = normalized.match(/(?:ma giao dich|transaction ref|tham chieu)\s*[:#-]?\s*([a-z0-9._/-]{3,80})/i)?.[1];
    return reference || undefined;
  }

  private normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
}
