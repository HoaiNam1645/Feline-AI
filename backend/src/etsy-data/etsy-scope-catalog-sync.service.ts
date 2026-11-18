import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { EtsySourceService } from "./etsy-source.service";

@Injectable()
export class EtsyScopeCatalogSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EtsyScopeCatalogSyncService.name);
  constructor(private readonly prisma: PrismaService, private readonly source: EtsySourceService) {}

  async onApplicationBootstrap(): Promise<void> {
    const base = [
      this.scope("etsy.workspace.all", "Toàn bộ dữ liệu Etsy", "Xem dữ liệu của toàn bộ phòng Sell Etsy.", { rowScope: "workspace" }),
      this.scope("etsy.operations.basic", "Vận hành Etsy", "Đơn hàng, trạng thái và sản lượng Etsy.", { domain: "operations" }),
      this.scope("etsy.finance", "Tài chính Etsy", "Doanh thu, net, chi phí và lợi nhuận Etsy.", { domain: "finance" }),
      this.scope("etsy.team.performance", "Hiệu suất team Etsy", "Xem hiệu suất team và seller Etsy.", { domain: "team" }),
      this.scope("etsy.shops", "Shop Etsy", "Xem hiệu suất theo shop Etsy.", { domain: "shops" }),
      this.scope("etsy.fulfillment", "Fulfillment Etsy", "Xem chỉ số fulfillment của đơn Etsy.", { domain: "fulfillment" }),
      this.scope("etsy.support", "Hỗ trợ Etsy", "Xem case, help, message và refund tổng hợp.", { domain: "support" }),
      this.scope("etsy.products", "Sản phẩm Etsy", "Xem chỉ số sản phẩm, không chứa dữ liệu khách hàng.", { domain: "products" })
    ];
    await this.prisma.dataScope.createMany({ data: base, skipDuplicates: true });
    try {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const data = await this.source.dashboard(today, today, { sellerTeamIds: [], shopIds: [], sellerIds: [] });
      const dynamic = [
        ...data.filters.sellerTeams.map((item) => this.scope(`etsy.team:${item.id}`, `Team: ${item.name}`, "Giới hạn dữ liệu theo team Etsy.", { rowScope: "team", externalId: item.id })),
        ...data.filters.shops.map((item) => this.scope(`etsy.shop:${item.id}`, `Shop: ${item.name}`, "Giới hạn dữ liệu theo shop Etsy.", { rowScope: "shop", externalId: item.id })),
        ...data.filters.sellers.map((item) => this.scope(`etsy.seller:${item.id}`, `Seller: ${item.name}`, "Giới hạn dữ liệu theo seller Etsy.", { rowScope: "seller", externalId: item.id }))
      ];
      await this.prisma.dataScope.createMany({ data: dynamic, skipDuplicates: true });
      this.logger.log(`Đã đồng bộ ${base.length + dynamic.length} phạm vi Etsy vào Access Grant`);
    } catch (error) {
      this.logger.warn(`Chưa thể đồng bộ phạm vi Etsy động: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private scope(id: string, name: string, description: string, definition: Record<string, string>) {
    return { id, agentId: "etsy-ai", name, description, definition: definition as Prisma.InputJsonValue };
  }
}
