import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RowDataPacket } from "mysql2/promise";
import { AccessProfile } from "../auth/access-control";
import { TiktokMysqlService } from "./tiktok-mysql.service";
import { TiktokScopeService } from "./tiktok-scope.service";

type DataRow = RowDataPacket & Record<string, string | number | null>;

const TEAM_ALIASES = new Set(["g9b", "cashtom", "cashstorm", "cashstormteam"]);

function numeric(row: DataRow, key: string) {
  return Number(row[key] || 0);
}

function normalized(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

@Injectable()
export class TiktokDashboardService {
  constructor(private readonly db: TiktokMysqlService, private readonly scopes: TiktokScopeService) {}

  async get(
    actor: { role: UserRole; access: AccessProfile },
    startDate: string,
    endDate: string
  ) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(startDate) || !/^20\d{2}-\d{2}-\d{2}$/.test(endDate)) {
      throw new BadRequestException("Khoảng ngày không hợp lệ");
    }
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    if (end < start || end.getTime() - start.getTime() > 370 * 86_400_000) {
      throw new BadRequestException("Khoảng ngày phải từ 1 đến 371 ngày");
    }
    const nextEnd = new Date(end); nextEnd.setUTCDate(nextEnd.getUTCDate() + 1);
    const [startSql, endSql] = [`${startDate} 00:00:00`, `${nextEnd.toISOString().slice(0, 10)} 00:00:00`];

    const allTeams = await this.db.query<DataRow>("SELECT id, name, code FROM teams WHERE status = 'active'");
    const selectedTeams = allTeams.filter((team) => TEAM_ALIASES.has(normalized(team.code)) || TEAM_ALIASES.has(normalized(team.name)));
    if (!selectedTeams.length) throw new BadRequestException("Không tìm thấy team G9B hoặc cashtom trong nguồn dữ liệu");

    const scope = this.scopes.fromActor(actor);
    if (!scope.unrestricted && !scope.teamIds.length && !scope.storeIds.length && !scope.userIds.length) {
      throw new ForbiddenException("Tài khoản chưa được cấp phạm vi dữ liệu TikTok");
    }
    const fixedTeamIds = selectedTeams.map((team) => Number(team.id));
    const placeholders = fixedTeamIds.map(() => "?").join(",");
    const access = this.scopes.orderPredicate(scope, "o");
    const accessSql = scope.unrestricted ? "1 = 1" : access.sql;
    const storeAccess = this.scopes.storePredicate(scope, "s");
    const storeAccessSql = scope.unrestricted ? "1 = 1" : storeAccess.sql;
    const sharedParams = [startSql, endSql, ...fixedTeamIds, ...access.params];

    const [sellerRows, trendRows, statusRows, storeRows] = await Promise.all([
      this.db.query<DataRow>(`
        SELECT t.id AS teamId, t.name AS teamName, t.code AS teamCode,
               u.id AS sellerId, u.name AS sellerName,
               COUNT(DISTINCT o.id) AS orders,
               SUM(CASE WHEN o.fulfill_status = 'Fulfilled' THEN 1 ELSE 0 END) AS fulfilledOrders,
               COALESCE(SUM(od.items),0) AS items,
               COALESCE(SUM(o.profit_price),0) AS estimatedRevenue,
               COALESCE(SUM(ofs.fulfillmentCost),0) AS fulfillmentCost,
               COALESCE(MAX(ref.refundAmount),0) AS refundAmount,
               COALESCE(MAX(ad.adsSpend),0) AS adsSpend,
               COALESCE(MAX(st.storeCount),0) AS stores,
               MAX(o.updated_at) AS dataUpdatedAt
        FROM orders o
        JOIN users u ON u.id=o.user_id
        JOIN (SELECT user_id, team_id FROM user_details UNION SELECT manager_id, id FROM teams WHERE manager_id IS NOT NULL) tm ON tm.user_id=u.id
        JOIN teams t ON t.id=tm.team_id
        LEFT JOIN (SELECT order_id, SUM(quantity) items FROM order_details GROUP BY order_id) od ON od.order_id=o.order_id
        LEFT JOIN (SELECT order_id, SUM(COALESCE(fulfill_price,0)) fulfillmentCost FROM order_fulfillments GROUP BY order_id) ofs ON ofs.order_id=o.order_id
        LEFT JOIN (SELECT ro.user_id, SUM(COALESCE(r.amount,0)) refundAmount FROM refunds r JOIN orders ro ON ro.order_id=r.order_id WHERE r.update_time_us>=? AND r.update_time_us<? GROUP BY ro.user_id) ref ON ref.user_id=u.id
        LEFT JOIN (SELECT a.user_id, SUM(COALESCE(a.top_up_amount,0)) adsSpend FROM ads a WHERE a.top_up_date>=? AND a.top_up_date<? AND (a.approval_status IS NULL OR a.approval_status<>'rejected') GROUP BY a.user_id) ad ON ad.user_id=u.id
        LEFT JOIN (SELECT user_id, COUNT(*) storeCount FROM stores WHERE platform='tiktok' GROUP BY user_id) st ON st.user_id=u.id
        WHERE o.platform='tiktok' AND o.order_date>=? AND o.order_date<? AND t.id IN (${placeholders}) AND ${accessSql}
        GROUP BY t.id,t.name,t.code,u.id,u.name
        ORDER BY contributionBeforeAds DESC, estimatedRevenue DESC
      `.replace("ORDER BY contributionBeforeAds", "ORDER BY (COALESCE(SUM(o.profit_price),0)-COALESCE(SUM(ofs.fulfillmentCost),0)-COALESCE(MAX(ref.refundAmount),0)-COALESCE(MAX(ad.adsSpend),0))"),
      [startSql, endSql, startDate, nextEnd.toISOString().slice(0, 10), ...sharedParams]),
      this.db.query<DataRow>(`
        SELECT DATE(o.order_date) AS reportDate, t.id AS teamId, t.name AS teamName,
               COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(o.profit_price),0) AS estimatedRevenue
        FROM orders o JOIN (SELECT user_id, team_id FROM user_details UNION SELECT manager_id, id FROM teams WHERE manager_id IS NOT NULL) tm ON tm.user_id=o.user_id JOIN teams t ON t.id=tm.team_id
        WHERE o.platform='tiktok' AND o.order_date>=? AND o.order_date<? AND t.id IN (${placeholders}) AND ${accessSql}
        GROUP BY DATE(o.order_date),t.id,t.name ORDER BY reportDate
      `, sharedParams),
      this.db.query<DataRow>(`
        SELECT t.id AS teamId, t.name AS teamName,
               SUM(CASE WHEN o.fulfill_status='Fulfilled' THEN 1 ELSE 0 END) fulfilled,
               SUM(CASE WHEN o.fulfill_status='Pending' THEN 1 ELSE 0 END) pending,
               SUM(CASE WHEN o.fulfill_status='On Hold' THEN 1 ELSE 0 END) onHold,
               SUM(CASE WHEN o.fulfill_status='Canceled' OR UPPER(COALESCE(o.order_status,'')) IN ('CANCEL','CANCELED','CANCELLED') THEN 1 ELSE 0 END) cancelled
        FROM orders o JOIN (SELECT user_id, team_id FROM user_details UNION SELECT manager_id, id FROM teams WHERE manager_id IS NOT NULL) tm ON tm.user_id=o.user_id JOIN teams t ON t.id=tm.team_id
        WHERE o.platform='tiktok' AND o.order_date>=? AND o.order_date<? AND t.id IN (${placeholders}) AND ${accessSql}
        GROUP BY t.id,t.name
      `, sharedParams),
      this.db.query<DataRow>(`
        SELECT t.id AS teamId, t.name AS teamName, COUNT(DISTINCT s.id) totalStores,
               SUM(CASE WHEN COALESCE(s.is_die,0)=0 AND COALESCE(s.is_auth,0)=1 THEN 1 ELSE 0 END) healthyStores,
               SUM(CASE WHEN COALESCE(s.is_die,0)=1 OR COALESCE(s.is_auth,0)=0 THEN 1 ELSE 0 END) attentionStores
        FROM stores s JOIN (SELECT user_id, team_id FROM user_details UNION SELECT manager_id, id FROM teams WHERE manager_id IS NOT NULL) tm ON tm.user_id=s.user_id JOIN teams t ON t.id=tm.team_id
        WHERE s.platform='tiktok' AND t.id IN (${placeholders}) AND ${storeAccessSql}
        GROUP BY t.id,t.name
      `, [...fixedTeamIds, ...storeAccess.params])
    ]);

    const sellers = sellerRows.map((row) => {
      const estimatedRevenue = numeric(row, "estimatedRevenue");
      const fulfillmentCost = numeric(row, "fulfillmentCost");
      const refundAmount = numeric(row, "refundAmount");
      const adsSpend = numeric(row, "adsSpend");
      return {
        teamId: numeric(row, "teamId"), teamName: String(row.teamName), teamCode: row.teamCode ? String(row.teamCode) : null,
        sellerId: numeric(row, "sellerId"), sellerName: String(row.sellerName), orders: numeric(row, "orders"),
        fulfilledOrders: numeric(row, "fulfilledOrders"), items: numeric(row, "items"), stores: numeric(row, "stores"),
        estimatedRevenue, fulfillmentCost, refundAmount, adsSpend,
        contribution: estimatedRevenue - fulfillmentCost - refundAmount - adsSpend
      };
    });
    const teams = selectedTeams.map((team) => {
      const teamId = Number(team.id); const members = sellers.filter((seller) => seller.teamId === teamId);
      const status = statusRows.find((row) => numeric(row, "teamId") === teamId);
      const stores = storeRows.find((row) => numeric(row, "teamId") === teamId);
      const sum = (key: keyof typeof members[number]) => members.reduce((total, member) => total + Number(member[key] || 0), 0);
      return {
        id: teamId, name: String(team.name), code: team.code ? String(team.code) : null,
        orders: sum("orders"), fulfilledOrders: sum("fulfilledOrders"), items: sum("items"),
        estimatedRevenue: sum("estimatedRevenue"), fulfillmentCost: sum("fulfillmentCost"), refundAmount: sum("refundAmount"),
        adsSpend: sum("adsSpend"), contribution: sum("contribution"), sellerCount: members.length,
        stores: { total: numeric(stores || {} as DataRow, "totalStores"), healthy: numeric(stores || {} as DataRow, "healthyStores"), attention: numeric(stores || {} as DataRow, "attentionStores") },
        statuses: { fulfilled: numeric(status || {} as DataRow, "fulfilled"), pending: numeric(status || {} as DataRow, "pending"), onHold: numeric(status || {} as DataRow, "onHold"), cancelled: numeric(status || {} as DataRow, "cancelled") }
      };
    });
    return {
      range: { startDate, endDate, timeZone: "America/Los_Angeles" },
      teams, sellers,
      trend: trendRows.map((row) => ({ reportDate: String(row.reportDate).slice(0, 10), teamId: numeric(row, "teamId"), teamName: String(row.teamName), orders: numeric(row, "orders"), estimatedRevenue: numeric(row, "estimatedRevenue") })),
      source: { access: "read-only", generatedAtUtc: new Date().toISOString(), dataUpdatedAtUtc: sellerRows.reduce<string | null>((latest, row) => !latest || String(row.dataUpdatedAt) > latest ? String(row.dataUpdatedAt) : latest, null) }
    };
  }
}
