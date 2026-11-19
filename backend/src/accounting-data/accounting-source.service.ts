import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { requiredNumber, requiredString } from "../config/runtime-config";
import { AccountingDataDomain, AccountingDataPayload } from "./accounting-data.types";

@Injectable()
export class AccountingSourceService {
  private readonly logger = new Logger(AccountingSourceService.name);

  async get(domain: AccountingDataDomain, startDate: string, endDate: string, query = ""): Promise<AccountingDataPayload> {
    const endpoint = requiredString("ACCOUNTING_DATA_API_URL");
    const secret = requiredString("ACCOUNTING_DATA_API_SECRET");
    const timeoutMs = requiredNumber("ACCOUNTING_DATA_TIMEOUT_MS", 15_000);
    const url = new URL(endpoint);
    url.searchParams.set("domain", domain);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    if (query) url.searchParams.set("q", query);

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { headers: { "X-Feline-AI-Secret": secret, Accept: "application/json" }, signal: controller.signal });
        const payload = await response.json().catch(() => null) as AccountingDataPayload | { message?: string } | null;
        if (!response.ok) throw new Error(`Accounting source HTTP ${response.status}: ${payload && "message" in payload ? payload.message : "unknown"}`);
        return payload as AccountingDataPayload;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Accounting source attempt ${attempt} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
      } finally { clearTimeout(timer); }
    }
    this.logger.error(`Accounting source unavailable: ${lastError instanceof Error ? lastError.message : "Unknown error"}`);
    throw new ServiceUnavailableException("Dữ liệu kế toán đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau.");
  }
}
