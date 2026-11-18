import { Injectable } from "@nestjs/common";
import { TiktokDataDomain } from "./tiktok-data.types";

export interface TiktokRoute {
  kind: "knowledge" | "data";
  domain?: TiktokDataDomain;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class TiktokQuestionRouterService {
  route(question: string, now = new Date()): TiktokRoute {
    const normalized = this.normalize(question);
    const domain = this.domain(normalized);
    if (!domain) return { kind: "knowledge" };
    const range = this.dateRange(normalized, now);
    return { kind: "data", domain, ...range };
  }

  private domain(question: string): TiktokDataDomain | undefined {
    if (/\b\d{8,}\b/.test(question) || /\b(tracking|order id|ma don|chi tiet don)\b/.test(question)) return "orders";
    if (/\b(danh sach|liet ke|cho (?:toi|minh)|xem)\s+(?:\d+\s+)?(?:don|don hang)\b/.test(question)
      || /\b(?:don|don hang)\s+(?:gan nhat|moi nhat|cu nhat)\b/.test(question)
      || /\btrang thai (?:cua )?(?:don|don hang)\b/.test(question)) return "orders";
    if (/\b(design|designer|mockup|file emb|thiet ke|backlog design|nang suat design)\b/.test(question)) return "design";
    if (/\b(fulfill|fulfillment|xuong|vendor|chi phi fulfill|gia fulfill|so code|ship late|ship overdue|sla)\b/.test(question)) return "fulfillment";
    if (/\b(payout|paid|tien tra|tien nhan|thuc tra|quyet toan|settlement|doanh thu|doanh so|loi nhuan|lai|refund|hoan tien|ads|chi phi|phi)\b/.test(question)) return "finance";
    if (/\b(store|shop|tai khoan tiktok|mat auth|is auth|store die|shop die|vi pham|violation)\b/.test(question)) return "stores";
    if (/\b(team|seller|nhan vien|bang xep hang|top seller|kpi seller|creator)\b/.test(question)) return "team";
    if (/\b(tien)\b/.test(question)) return "finance";
    if (/\b(ma don|order id|tracking|don nao|chi tiet don|trang thai don|so don|shop code)\b/.test(question)) return "orders";
    if (/\b(tong quan|bao cao|bao nhieu don|bao nhieu item|tinh hinh|hom nay co|du lieu den|cap nhat den|canh bao chat luong)\b/.test(question)) return "overview";
    return undefined;
  }

  private dateRange(question: string, now: Date): { startDate: string; endDate: string } {
    const la = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(now);
    const today = new Date(`${la}T00:00:00Z`);
    let start = new Date(today); let end = new Date(today);
    if (/hom qua/.test(question)) { start.setUTCDate(start.getUTCDate() - 1); end = new Date(start); }
    else if (/tuan truoc/.test(question)) {
      const day = today.getUTCDay() || 7;
      end.setUTCDate(end.getUTCDate() - day);
      start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
    }
    else if (/gan nhat|moi nhat/.test(question)) { start.setUTCDate(start.getUTCDate() - 29); }
    else if (/7 ngay|tuan nay|trong tuan/.test(question)) { start.setUTCDate(start.getUTCDate() - 6); }
    else if (/30 ngay/.test(question)) { start.setUTCDate(start.getUTCDate() - 29); }
    else if (/nam nay/.test(question)) { start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1)); }
    else if (/thang nay/.test(question)) { start.setUTCDate(1); }
    else if (/thang truoc/.test(question)) {
      end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    }
    const namedMonth = question.match(/\bthang\s+(1[0-2]|0?[1-9])(?:\s*(?:\/|nam\s+)(20\d{2}))?\b/);
    if (namedMonth && !/thang (?:nay|truoc)/.test(question)) {
      const month = Number(namedMonth[1]);
      const year = namedMonth[2] ? Number(namedMonth[2]) : today.getUTCFullYear();
      start = new Date(Date.UTC(year, month - 1, 1));
      end = new Date(Date.UTC(year, month, 0));
    }
    const quarter = question.match(/\bquy\s*([1-4])(?:\s*(?:\/|nam\s+)(20\d{2}))?\b/);
    if (quarter) {
      const value = Number(quarter[1]);
      const year = quarter[2] ? Number(quarter[2]) : today.getUTCFullYear();
      start = new Date(Date.UTC(year, (value - 1) * 3, 1));
      end = new Date(Date.UTC(year, value * 3, 0));
    }
    const explicit = question.match(/(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)/g);
    if (explicit?.length) {
      const dates = explicit.map((value) => {
        const [year, month, day] = value.split(/[-\/]/).map(Number);
        return new Date(Date.UTC(year, month - 1, day));
      }).sort((a,b) => a.getTime() - b.getTime());
      start = dates[0]; end = dates.at(-1)!;
    }
    return { startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10) };
  }

  private normalize(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi-VN");
  }
}
