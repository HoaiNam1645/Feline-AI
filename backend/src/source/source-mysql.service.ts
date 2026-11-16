import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPool,
  Pool,
  PoolOptions,
  RowDataPacket
} from "mysql2/promise";
import { requiredString } from "../config/runtime-config";

@Injectable()
export class SourceMysqlService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const sourceUrl = new URL(requiredString("SOURCE_MYSQL_URL"));
    if (sourceUrl.protocol !== "mysql:") {
      throw new Error("SOURCE_MYSQL_URL must use the mysql protocol");
    }

    const sslEnabled = process.env.SOURCE_MYSQL_SSL !== "false";
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
      timezone: "Z",
      dateStrings: true,
      multipleStatements: false,
      ssl: sslEnabled
        ? {
            ca: readFileSync(
              resolve(
                requiredString(
                  "SOURCE_MYSQL_CA_PATH",
                  "certs/shop-test-mysql-ca.pem"
                )
              ),
              "utf8"
            ),
            rejectUnauthorized: true
          }
        : undefined
    };

    this.pool = createPool(options);
  }

  async query<T extends RowDataPacket>(
    sql: string,
    params: Array<string | number | null> = []
  ): Promise<T[]> {
    const [rows] = await this.pool.execute<T[]>(sql, params);
    return rows;
  }

  async connectionInfo(): Promise<Record<string, string>> {
    const rows = await this.query<
      RowDataPacket & {
        currentUser: string;
        serverVersion: string;
        timeZone: string;
        sslCipher: string;
      }
    >(`
      SELECT CURRENT_USER() AS currentUser,
             @@version AS serverVersion,
             @@session.time_zone AS timeZone,
             COALESCE((SELECT VARIABLE_VALUE
                       FROM performance_schema.session_status
                       WHERE VARIABLE_NAME = 'Ssl_cipher'), '') AS sslCipher
    `);
    return rows[0];
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
