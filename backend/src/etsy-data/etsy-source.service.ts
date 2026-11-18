import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { requiredNumber, requiredString } from "../config/runtime-config";
import { EtsyDashboardData, EtsyDashboardFilters } from "./etsy-data.types";

@Injectable()
export class EtsySourceService {
  private readonly logger = new Logger(EtsySourceService.name);

  async dashboard(startDate: string, endDate: string, filters: EtsyDashboardFilters): Promise<EtsyDashboardData> {
    const endpoint = requiredString("ETSY_DATA_API_URL");
    const secret = requiredString("ETSY_DATA_API_SECRET");
    const timeoutMs = requiredNumber("ETSY_DATA_TIMEOUT_MS", 15_000);
    const url = new URL(endpoint);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("sellerTeamId", filters.sellerTeamIds.join(",") || "all");
    url.searchParams.set("shopId", filters.shopIds.join(",") || "all");
    url.searchParams.set("sellerId", filters.sellerIds.join(",") || "all");

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          headers: { "X-Sync-Secret": secret, Accept: "application/json" },
          signal: controller.signal
        });
        const payload = await response.json().catch(() => null) as EtsyDashboardData | { message?: string } | null;
        if (!response.ok) throw new Error(`Etsy source HTTP ${response.status}: ${payload && "message" in payload ? payload.message : "unknown"}`);
        return payload as EtsyDashboardData;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Etsy dashboard source attempt ${attempt} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
      } finally {
        clearTimeout(timer);
      }
    }
    this.logger.error(`Etsy dashboard source unavailable: ${lastError instanceof Error ? lastError.message : "Unknown error"}`);
    throw new ServiceUnavailableException("Dữ liệu Etsy đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau.");
  }
}
