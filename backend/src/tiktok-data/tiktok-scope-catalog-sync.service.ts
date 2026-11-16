import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RowDataPacket } from "mysql2/promise";
import { PrismaService } from "../database/prisma.service";
import { TiktokMysqlService } from "./tiktok-mysql.service";

interface ScopeRow extends RowDataPacket { id: number; name: string; }

@Injectable()
export class TiktokScopeCatalogSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TiktokScopeCatalogSyncService.name);
  constructor(private readonly db: TiktokMysqlService, private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const [teams, users, stores] = await Promise.all([
        this.db.query<ScopeRow>("SELECT id, name FROM teams WHERE status = 'active' ORDER BY name"),
        this.db.query<ScopeRow>("SELECT id, name FROM users WHERE status = 'active' ORDER BY name"),
        this.db.query<ScopeRow>("SELECT id, store_name AS name FROM stores WHERE platform = 'tiktok' ORDER BY store_name")
      ]);
      const scopes = [
        ...teams.map((row) => this.scope(`tiktok.team:${row.id}`, `Team: ${row.name}`, "team", row.id)),
        ...users.map((row) => this.scope(`tiktok.user:${row.id}`, `Seller: ${row.name}`, "user", row.id)),
        ...stores.map((row) => this.scope(`tiktok.store:${row.id}`, `Store: ${row.name}`, "store", row.id))
      ];
      await this.prisma.dataScope.createMany({ data: scopes, skipDuplicates: true });
      this.logger.log(`Đã đồng bộ ${scopes.length} phạm vi TikTok vào Access Grant`);
    } catch (error) {
      this.logger.warn(`Chưa thể đồng bộ phạm vi TikTok: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private scope(id: string, name: string, type: string, externalId: number) {
    return {
      id, agentId: "tiktok-ai", name,
      description: `Giới hạn dữ liệu TikTok theo ${type} #${externalId}.`,
      definition: { rowScope: type, externalId, pii: false } as Prisma.InputJsonValue
    };
  }
}
