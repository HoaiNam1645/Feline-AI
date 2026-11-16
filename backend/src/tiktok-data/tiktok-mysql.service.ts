import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createPool, Pool, PoolOptions, RowDataPacket } from "mysql2/promise";
import { requiredString } from "../config/runtime-config";

@Injectable()
export class TiktokMysqlService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const sourceUrl = new URL(requiredString("TIKTOK_MYSQL_URL"));
    if (sourceUrl.protocol !== "mysql:") {
      throw new Error("TIKTOK_MYSQL_URL must use the mysql protocol");
    }

    const options: PoolOptions = {
      host: sourceUrl.hostname,
      port: Number(sourceUrl.port || 3306),
      user: decodeURIComponent(sourceUrl.username),
      password: decodeURIComponent(sourceUrl.password),
      database: sourceUrl.pathname.slice(1),
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 60_000,
      connectTimeout: 10_000,
      enableKeepAlive: true,
      // Match the source application's MySQL session so TIMESTAMP report windows
      // resolve to the same business day as Team Performance.
      timezone: "+07:00",
      dateStrings: true,
      multipleStatements: false,
      ssl: process.env.TIKTOK_MYSQL_SSL === "true"
        ? { rejectUnauthorized: process.env.TIKTOK_MYSQL_SSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined
    };
    this.pool = createPool(options);
  }

  async query<T extends RowDataPacket>(
    sql: string,
    params: Array<string | number | null> = []
  ): Promise<T[]> {
    const normalized = sql.trim().replace(/^\(+/, "").toUpperCase();
    if (!/^(SELECT|WITH|SHOW|EXPLAIN)\b/.test(normalized)) {
      throw new Error("TikTok source only accepts read-only queries");
    }
    const connection = await this.pool.getConnection();
    try {
      // `timezone` in mysql2 controls JS date conversion, but report filtering
      // also needs the MySQL session timezone used by the source application.
      await connection.query("SET time_zone = '+07:00'");
      const [rows] = await connection.execute<T[]>(sql, params);
      return rows;
    } finally {
      connection.release();
    }
  }

  async connectionInfo(): Promise<Record<string, string>> {
    const rows = await this.query<RowDataPacket & {
      currentUser: string;
      serverVersion: string;
      timeZone: string;
      databaseName: string;
    }>(`
      SELECT CURRENT_USER() AS currentUser,
             @@version AS serverVersion,
             @@session.time_zone AS timeZone,
             DATABASE() AS databaseName
    `);
    return rows[0];
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
