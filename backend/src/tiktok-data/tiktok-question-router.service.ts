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
    if (/\b(design|designer|mockup|file emb|thiet ke|backlog design|nang suat design)\b/.test(question)) return "design";
    if (/\b(fulfill|fulfillment|xuong|vendor|chi phi fulfill|gia fulfill|so code|ship late|ship overdue|sla)\b/.test(question)) return "fulfillment";
    if (/\b(team|seller|nhan vien|bang xep hang|top seller|kpi seller|creator)\b/.test(question)) return "team";
    if (/\b(doanh thu|doanh so|tien|loi nhuan|lai|quyet toan|settlement|paid|refund|hoan tien|ads|chi phi|phi)\b/.test(question)) return "finance";
    if (/\b(store|shop|tai khoan tiktok|mat auth|is auth|store die|shop die|vi pham|violation)\b/.test(question)) return "stores";
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
    else if (/7 ngay|tuan nay|trong tuan/.test(question)) { start.setUTCDate(start.getUTCDate() - 6); }
    else if (/30 ngay/.test(question)) { start.setUTCDate(start.getUTCDate() - 29); }
    else if (/thang nay/.test(question)) { start.setUTCDate(1); }
    else if (/thang truoc/.test(question)) {
      end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
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
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN");
  }
}
