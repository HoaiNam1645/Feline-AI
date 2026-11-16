import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2/promise";
import { TiktokMysqlService } from "./tiktok-mysql.service";
import { TiktokScopeService } from "./tiktok-scope.service";
import { TiktokToolInput, TiktokToolOutput, TiktokToolSource } from "./tiktok-data.types";

type DataRow = RowDataPacket & Record<string, string | number | null>;

abstract class TiktokReadTool {
  abstract readonly id: string;
  abstract readonly description: string;
  abstract execute(input: TiktokToolInput): Promise<TiktokToolOutput>;

  protected window(input: TiktokToolInput): [string, string] {
    const next = new Date(`${input.endDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return [`${input.startDate} 00:00:00`, `${next.toISOString().slice(0, 10)} 00:00:00`];
  }

  protected source(
    tables: string[],
    freshness: unknown,
    warnings: string[] = []
  ): TiktokToolSource {
    const generatedAtUtc = new Date().toISOString();
    const parsed = typeof freshness === "string"
      ? new Date(`${freshness.replace(" ", "T")}Z`)
      : null;
    return {
      id: "feline-tiktok",
      access: "read-only",
      tables,
      generatedAtUtc,
      dataUpdatedAtUtc: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : generatedAtUtc,
      timeZone: "America/Los_Angeles",
      qualityWarnings: warnings
    };
  }

  protected range(input: TiktokToolInput) {
    return { startDate: input.startDate, endDate: input.endDate, timeZone: input.timeZone };
  }
}

@Injectable()
export class TiktokOverviewTool extends TiktokReadTool {
  readonly id = "tiktok.overview.get";
  readonly description = "Tổng quan đơn, item, tiền, trạng thái và cảnh báo chất lượng TikTok.";
  constructor(private readonly db: TiktokMysqlService, private readonly scopes: TiktokScopeService) { super(); }

  async execute(input: TiktokToolInput): Promise<TiktokToolOutput> {
    this.scopes.assertDomain(input.scope, "overview");
    const [start, end] = this.window(input);
    const predicate = this.scopes.orderPredicate(input.scope);
    const rows = await this.db.query<DataRow>(`
      SELECT COUNT(DISTINCT o.id) AS orders,
             COALESCE(SUM(od.item_rows), 0) AS itemLines,
             COALESCE(SUM(od.quantity), 0) AS items,
             COALESCE(SUM(o.total), 0) AS grossOrderValue,
             COALESCE(SUM(o.profit_price), 0) AS estimatedRevenue,
             COALESCE(SUM(o.net_profit_price), 0) AS storedNetProfit,
             COALESCE(SUM(ofs.fulfill_cost), 0) AS fulfillmentCost,
             COALESCE(SUM(ref.refund_amount), 0) AS refundAmount,
             SUM(CASE WHEN o.fulfill_status = 'Pending' THEN 1 ELSE 0 END) AS pendingOrders,
             SUM(CASE WHEN o.fulfill_status = 'On Hold' THEN 1 ELSE 0 END) AS onHoldOrders,
             SUM(CASE WHEN o.fulfill_status = 'Fulfilled' THEN 1 ELSE 0 END) AS fulfilledOrders,
             SUM(CASE WHEN o.fulfill_status = 'Canceled' OR UPPER(COALESCE(o.order_status,'')) IN ('CANCEL','CANCELED','CANCELLED') THEN 1 ELSE 0 END) AS cancelledOrders,
             SUM(CASE WHEN ofs.missing_price > 0 THEN 1 ELSE 0 END) AS missingCostOrders,
             MAX(o.updated_at) AS dataUpdatedAt
      FROM orders o
      LEFT JOIN (
        SELECT order_id, COUNT(*) AS item_rows, SUM(quantity) AS quantity
        FROM order_details GROUP BY order_id
      ) od ON od.order_id = o.order_id
      LEFT JOIN (
        SELECT order_id, SUM(COALESCE(fulfill_price, 0)) AS fulfill_cost,
               SUM(CASE WHEN fulfill_price IS NULL OR fulfill_price <= 0 THEN 1 ELSE 0 END) AS missing_price
        FROM order_fulfillments GROUP BY order_id
      ) ofs ON ofs.order_id = o.order_id
      LEFT JOIN (
        SELECT order_id, SUM(COALESCE(amount, 0)) AS refund_amount
        FROM refunds GROUP BY order_id
      ) ref ON ref.order_id = o.order_id
      WHERE o.platform = 'tiktok' AND o.order_date >= ? AND o.order_date < ? AND ${predicate.sql}
    `, [start, end, ...predicate.params]);
    const row = rows[0] || {};
    const missing = Number(row.missingCostOrders || 0);
    return {
      domain: "overview",
      range: this.range(input),
      data: {
        orders: Number(row.orders || 0), itemLines: Number(row.itemLines || 0), items: Number(row.items || 0),
        grossOrderValue: Number(row.grossOrderValue || 0), estimatedRevenue: Number(row.estimatedRevenue || 0),
        storedNetProfit: Number(row.storedNetProfit || 0), fulfillmentCost: Number(row.fulfillmentCost || 0),
        refundAmount: Number(row.refundAmount || 0),
        operationalContributionBeforeAds: Number(row.estimatedRevenue || 0) - Number(row.fulfillmentCost || 0) - Number(row.refundAmount || 0),
        statuses: {
          pending: Number(row.pendingOrders || 0), onHold: Number(row.onHoldOrders || 0),
          fulfilled: Number(row.fulfilledOrders || 0), cancelled: Number(row.cancelledOrders || 0)
        },
        missingCostOrders: missing
      },
      source: this.source(
        ["orders", "order_details", "order_fulfillments", "refunds"],
        row.dataUpdatedAt,
        missing ? [`Có ${missing} đơn có fulfillment thiếu giá hoặc giá bằng 0 trong phạm vi báo cáo.`] : []
      )
    };
  }
}

@Injectable()
export class TiktokOrdersTool extends TiktokReadTool {
  readonly id = "tiktok.orders.search";
  readonly description = "Tra cứu đơn TikTok theo order ID, tracking, SO, shop code hoặc tổng hợp danh sách theo kỳ.";
  constructor(private readonly db: TiktokMysqlService, private readonly scopes: TiktokScopeService) { super(); }

  async execute(input: TiktokToolInput): Promise<TiktokToolOutput> {
    this.scopes.assertDomain(input.scope, "orders");
    const [start, end] = this.window(input);
    const predicate = this.scopes.orderPredicate(input.scope);
    const identifiers = this.identifiers(input.question);
    const identifierSql = identifiers.length ? `AND (
      o.order_id IN (${identifiers.map(() => "?").join(",")})
      OR o.tracking IN (${identifiers.map(() => "?").join(",")})
      OR o.so_code IN (${identifiers.map(() => "?").join(",")})
      OR o.shop_code IN (${identifiers.map(() => "?").join(",")})
      OR EXISTS (SELECT 1 FROM order_fulfillments ox WHERE ox.order_id = o.order_id AND ox.order_code IN (${identifiers.map(() => "?").join(",")}))
    )` : "";
    const identifierParams = identifiers.length ? [...identifiers, ...identifiers, ...identifiers, ...identifiers, ...identifiers] : [];
    const rows = await this.db.query<DataRow>(`
      SELECT o.order_id AS orderId, o.shop_code AS shopCode, o.so_code AS soCode,
             o.tracking, o.order_status AS orderStatus, o.fulfill_status AS fulfillStatus,
             o.order_date AS orderDate, o.currency, o.total, o.profit_price AS estimatedRevenue,
             o.net_profit_price AS storedNetProfit, u.name AS sellerName, t.name AS teamName,
             COALESCE(od.item_lines, 0) AS itemLines, COALESCE(od.quantity, 0) AS items,
             od.products, fu.name AS fulfillmentVendor, ofl.order_code AS vendorOrderCode,
             ofl.fulfill_price AS fulfillmentCost, ofl.fulfillment_date AS fulfilledAt,
             MAX(o.updated_at) OVER () AS dataUpdatedAt
      FROM orders o
      JOIN users u ON u.id = o.user_id
      LEFT JOIN user_details ud ON ud.user_id = u.id
      LEFT JOIN teams t ON t.id = ud.team_id
      LEFT JOIN (
        SELECT order_id, COUNT(*) AS item_lines, SUM(quantity) AS quantity,
               GROUP_CONCAT(DISTINCT product_name ORDER BY product_name SEPARATOR ' | ') AS products
        FROM order_details GROUP BY order_id
      ) od ON od.order_id = o.order_id
      LEFT JOIN order_fulfillments ofl ON ofl.id = (SELECT MAX(of2.id) FROM order_fulfillments of2 WHERE of2.order_id = o.order_id)
      LEFT JOIN fulfill_units fu ON fu.id = ofl.fulfillment_unit_id
      WHERE o.platform = 'tiktok' AND o.order_date >= ? AND o.order_date < ?
        AND ${predicate.sql} ${identifierSql}
      ORDER BY o.order_date DESC LIMIT 50
    `, [start, end, ...predicate.params, ...identifierParams]);
    return {
      domain: "orders", range: this.range(input),
      data: { identifiers, found: rows.length > 0, orders: rows.map((row) => ({ ...row, total: Number(row.total || 0), estimatedRevenue: Number(row.estimatedRevenue || 0), storedNetProfit: Number(row.storedNetProfit || 0), fulfillmentCost: Number(row.fulfillmentCost || 0), itemLines: Number(row.itemLines || 0), items: Number(row.items || 0) })) },
      source: this.source(["orders", "order_details", "order_fulfillments", "fulfill_units", "users", "teams"], rows[0]?.dataUpdatedAt)
    };
  }

  private identifiers(question: string): string[] {
    const values = question.match(/\b[A-Za-z0-9][A-Za-z0-9_-]{5,39}\b/g) || [];
    return [...new Set(values.filter((value) => /\d/.test(value)))].slice(0, 10);
  }
}

@Injectable()
export class TiktokFinanceTool extends TiktokReadTool {
  readonly id = "tiktok.money.summary";
  readonly description = "Tổng hợp các lớp doanh số, quyết toán, fulfillment, refund, ads và lợi nhuận TikTok.";
  constructor(private readonly db: TiktokMysqlService, private readonly scopes: TiktokScopeService) { super(); }

  async execute(input: TiktokToolInput): Promise<TiktokToolOutput> {
    this.scopes.assertDomain(input.scope, "finance");
    const [start, end] = this.window(input);
    const orderScope = this.scopes.orderPredicate(input.scope);
    const storeScope = this.scopes.storePredicate(input.scope);
    const [orders, refunds, ads, snapshots] = await Promise.all([
      this.db.query<DataRow>(`
        SELECT SUM(o.total) AS grossOrderValue, SUM(o.profit_price) AS estimatedRevenue,
               SUM(o.net_profit_price) AS storedNetProfit,
               (SELECT SUM(COALESCE(ofl.fulfill_price,0)) FROM order_fulfillments ofl
                JOIN orders ox ON ox.order_id = ofl.order_id
                WHERE ox.platform='tiktok' AND ox.order_date >= ? AND ox.order_date < ? AND ${orderScope.sql.replaceAll("o.", "ox.")}) AS fulfillmentCost,
               MAX(o.updated_at) AS dataUpdatedAt
        FROM orders o WHERE o.platform='tiktok' AND o.order_date >= ? AND o.order_date < ? AND ${orderScope.sql}
      `, [start, end, ...orderScope.params, start, end, ...orderScope.params]),
      this.db.query<DataRow>(`
        SELECT SUM(r.amount) AS refundAmount, SUM(r.shipping_fee) AS refundShipping,
               COUNT(*) AS refundCases, MAX(r.updated_at) AS dataUpdatedAt
        FROM refunds r JOIN orders o ON o.order_id = r.order_id
        WHERE r.update_time_us >= ? AND r.update_time_us < ? AND ${orderScope.sql}
      `, [start, end, ...orderScope.params]),
      this.db.query<DataRow>(`
        SELECT SUM(a.top_up_amount) AS adsSpend, COUNT(*) AS adsEntries, MAX(a.updated_at) AS dataUpdatedAt
        FROM ads a JOIN stores s ON s.id = a.store_id
        WHERE a.top_up_date >= ? AND a.top_up_date < ?
          AND (a.approval_status IS NULL OR a.approval_status <> 'rejected') AND ${storeScope.sql}
      `, [input.startDate, end.slice(0, 10), ...storeScope.params]),
      this.db.query<DataRow>(`
        SELECT SUM(f.statement_settlement) AS statementSettlement,
               SUM(f.statement_fee) AS statementFee, SUM(f.paid) AS paidAmount,
               SUM(f.net_sales) AS snapshotNetSales, COUNT(*) AS snapshotRows,
               MAX(f.synced_at) AS dataUpdatedAt
        FROM finance_monthly_snapshots f JOIN stores s ON s.id = f.store_id
        WHERE (f.year * 100 + f.month) BETWEEN (? * 100 + ?) AND (? * 100 + ?)
          AND ${storeScope.sql}
      `, [Number(input.startDate.slice(0,4)), Number(input.startDate.slice(5,7)), Number(input.endDate.slice(0,4)), Number(input.endDate.slice(5,7)), ...storeScope.params])
    ]);
    const o = orders[0] || {}; const r = refunds[0] || {}; const a = ads[0] || {}; const s = snapshots[0] || {};
    const estimated = Number(o.estimatedRevenue || 0); const fulfillment = Number(o.fulfillmentCost || 0);
    const refund = Number(r.refundAmount || 0); const adsSpend = Number(a.adsSpend || 0);
    const warnings: string[] = [];
    if (!Number(a.adsEntries || 0)) warnings.push("Chưa có dữ liệu ads trong phạm vi được chọn; contribution profit chưa phải lợi nhuận cuối cùng.");
    if (!Number(s.snapshotRows || 0)) warnings.push("Không có finance snapshot trong phạm vi được chọn; chưa thể kết luận tiền TikTok thực quyết toán.");
    return {
      domain: "finance", range: this.range(input),
      data: {
        grossOrderValue: Number(o.grossOrderValue || 0), estimatedRevenue: estimated,
        storedNetProfit: Number(o.storedNetProfit || 0), fulfillmentCost: fulfillment,
        refundAmount: refund, refundShipping: Number(r.refundShipping || 0), refundCases: Number(r.refundCases || 0),
        adsSpend, operationalContribution: estimated - fulfillment - refund - adsSpend,
        statementSettlement: Number(s.statementSettlement || 0), statementFee: Number(s.statementFee || 0),
        paidAmount: Number(s.paidAmount || 0), snapshotNetSales: Number(s.snapshotNetSales || 0), snapshotRows: Number(s.snapshotRows || 0)
      },
      source: this.source(["orders", "order_fulfillments", "refunds", "ads", "finance_monthly_snapshots"], s.dataUpdatedAt || o.dataUpdatedAt || r.dataUpdatedAt, warnings)
    };
  }
}

@Injectable()
export class TiktokTeamTool extends TiktokReadTool {
  readonly id = "tiktok.team.performance";
  readonly description = "KPI team và seller theo đơn, item, doanh thu, fulfillment, refund và lợi nhuận đóng góp.";
  constructor(private readonly db: TiktokMysqlService, private readonly scopes: TiktokScopeService) { super(); }

  async execute(input: TiktokToolInput): Promise<TiktokToolOutput> {
    this.scopes.assertDomain(input.scope, "team");
    if (this.isMembershipQuestion(input.question)) {
      return this.members(input);
    }
    const [start, end] = this.window(input); const predicate = this.scopes.orderPredicate(input.scope);
    const rows = await this.db.query<DataRow>(`
      SELECT COALESCE(t.id, 0) AS teamId, COALESCE(t.name, 'Chưa gán team') AS teamName,
             u.id AS sellerId, u.name AS sellerName, COUNT(DISTINCT o.id) AS orders,
             COALESCE(SUM(od.quantity),0) AS items, SUM(o.profit_price) AS estimatedRevenue,
             SUM(COALESCE(ofs.fulfill_cost,0)) AS fulfillmentCost,
             SUM(COALESCE(ref.refund_amount,0)) AS refundAmount,
             SUM(o.profit_price)-SUM(COALESCE(ofs.fulfill_cost,0))-SUM(COALESCE(ref.refund_amount,0)) AS contributionBeforeAds,
             MAX(o.updated_at) AS dataUpdatedAt
      FROM orders o JOIN users u ON u.id=o.user_id
      LEFT JOIN user_details ud ON ud.user_id=u.id LEFT JOIN teams t ON t.id=ud.team_id
      LEFT JOIN (SELECT order_id, SUM(quantity) quantity FROM order_details GROUP BY order_id) od ON od.order_id=o.order_id
      LEFT JOIN (SELECT order_id, SUM(COALESCE(fulfill_price,0)) fulfill_cost FROM order_fulfillments GROUP BY order_id) ofs ON ofs.order_id=o.order_id
      LEFT JOIN (SELECT order_id, SUM(COALESCE(amount,0)) refund_amount FROM refunds GROUP BY order_id) ref ON ref.order_id=o.order_id
      WHERE o.platform='tiktok' AND o.order_date>=? AND o.order_date<? AND ${predicate.sql}
      GROUP BY t.id,t.name,u.id,u.name ORDER BY contributionBeforeAds DESC LIMIT 100
    `, [start, end, ...predicate.params]);
    return { domain: "team", range: this.range(input), data: { rows: rows.map((row) => this.numbers(row, ["teamId","sellerId","orders","items","estimatedRevenue","fulfillmentCost","refundAmount","contributionBeforeAds"])) }, source: this.source(["teams","users","user_details","orders","order_details","order_fulfillments","refunds"], rows[0]?.dataUpdatedAt, ["Contribution hiện chưa trừ ads do bảng ads chưa có dữ liệu đầy đủ."]) };
  }

  private async members(input: TiktokToolInput): Promise<TiktokToolOutput> {
    const keyword = this.teamKeyword(input.question);
    const scope = this.memberScope(input);
    const keywordSql = keyword ? "AND (LOWER(t.name) = LOWER(?) OR LOWER(t.code) = LOWER(?))" : "";
    const keywordParams = keyword ? [keyword, keyword] : [];
    const rows = await this.db.query<DataRow>(`
      SELECT t.id AS teamId, t.name AS teamName, t.code AS teamCode,
             manager.id AS managerId, manager.name AS managerName,
             u.id AS userId, u.name AS userName, u.status AS userStatus,
             ud.employee_code AS employeeCode, p.name AS positionName,
             d.name AS departmentName,
             GREATEST(t.updated_at, u.updated_at, ud.updated_at) AS dataUpdatedAt
      FROM teams t
      LEFT JOIN users manager ON manager.id = t.manager_id
      JOIN user_details ud ON ud.team_id = t.id
      JOIN users u ON u.id = ud.user_id
      LEFT JOIN positions p ON p.id = ud.position_id
      LEFT JOIN departments d ON d.id = ud.department_id
      WHERE t.status = 'active' AND ${scope.sql} ${keywordSql}
      ORDER BY t.name, CASE WHEN u.id = t.manager_id THEN 0 ELSE 1 END, u.status, u.name
      LIMIT 300
    `, [...scope.params, ...keywordParams]);
    const teams = new Map<number, {
      teamId: number; teamName: string; teamCode: string | null;
      manager: { id: number | null; name: string | null };
      activeMembers: unknown[]; inactiveMembers: unknown[];
    }>();
    for (const row of rows) {
      const teamId = Number(row.teamId);
      const team = teams.get(teamId) || {
        teamId, teamName: String(row.teamName), teamCode: row.teamCode === null ? null : String(row.teamCode),
        manager: { id: row.managerId === null ? null : Number(row.managerId), name: row.managerName === null ? null : String(row.managerName) },
        activeMembers: [], inactiveMembers: []
      };
      const member = {
        id: Number(row.userId), name: String(row.userName), employeeCode: row.employeeCode,
        position: row.positionName, department: row.departmentName,
        isManager: row.managerId !== null && Number(row.userId) === Number(row.managerId)
      };
      if (String(row.userStatus).toLowerCase() === "active") team.activeMembers.push(member);
      else team.inactiveMembers.push(member);
      teams.set(teamId, team);
    }
    return {
      domain: "team",
      range: this.range(input),
      data: {
        mode: "members",
        keyword,
        found: teams.size > 0,
        teams: [...teams.values()].map((team) => ({
          ...team,
          activeMemberCount: team.activeMembers.length,
          inactiveMemberCount: team.inactiveMembers.length
        }))
      },
      source: this.source(
        ["teams", "users", "user_details", "positions", "departments"],
        rows[0]?.dataUpdatedAt,
        keyword && !teams.size ? [`Không tìm thấy team có tên hoặc mã chính xác là ${keyword} trong phạm vi được cấp.`] : []
      )
    };
  }

  private isMembershipQuestion(question: string): boolean {
    const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /\b(nhung ai|gom ai|thanh vien|danh sach|ai trong team|co ai)\b/.test(normalized);
  }

  private teamKeyword(question: string): string | null {
    const match = question.match(/\bteam\s+([\p{L}\p{N}_-]{1,40})/iu);
    return match?.[1]?.trim() || null;
  }

  private memberScope(input: TiktokToolInput): { sql: string; params: number[] } {
    if (input.scope.unrestricted) return { sql: "1 = 1", params: [] };
    const conditions: string[] = [];
    const params: number[] = [];
    if (input.scope.teamIds.length) {
      conditions.push(`t.id IN (${input.scope.teamIds.map(() => "?").join(",")})`);
      params.push(...input.scope.teamIds);
    }
    if (input.scope.userIds.length) {
      conditions.push(`u.id IN (${input.scope.userIds.map(() => "?").join(",")})`);
      params.push(...input.scope.userIds);
    }
    if (input.scope.storeIds.length) {
      conditions.push(`u.id IN (SELECT s_scope.user_id FROM stores s_scope WHERE s_scope.id IN (${input.scope.storeIds.map(() => "?").join(",")}))`);
      params.push(...input.scope.storeIds);
    }
    return { sql: conditions.length ? `(${conditions.join(" OR ")})` : "0 = 1", params };
  }

  private numbers(row: DataRow, fields: string[]) { const output: Record<string, unknown> = { ...row }; fields.forEach((field) => { output[field] = Number(row[field] || 0); }); return output; }
}

@Injectable()
export class TiktokStoresTool extends TiktokReadTool {
  readonly id = "tiktok.stores.health";
  readonly description = "Sức khỏe store, kết nối, trạng thái seller và hiệu suất theo store.";
  constructor(private readonly db: TiktokMysqlService, private readonly scopes: TiktokScopeService) { super(); }

  async execute(input: TiktokToolInput): Promise<TiktokToolOutput> {
    this.scopes.assertDomain(input.scope, "stores");
    const [start, end] = this.window(input); const predicate = this.scopes.storePredicate(input.scope);
    const rows = await this.db.query<DataRow>(`
      SELECT s.id AS storeId, s.store_name AS storeName, sd.account_code AS accountCode,
             td.shop_code AS shopCode, u.id AS ownerId, u.name AS ownerName, t.name AS teamName,
             s.status_id AS statusId, s.status_member AS memberStatus, s.is_auth AS isAuth,
             s.is_die AS isDie, s.is_appeal AS isAppeal, td.seller_status AS sellerStatus,
             td.total_product AS totalProducts, td.to_ship AS toShip, td.ship_late AS shipLate,
             td.ship_overdue AS shipOverdue, td.score_star_shop AS shopScore, td.violation,
             COUNT(DISTINCT o.id) AS orders, SUM(COALESCE(o.profit_price,0)) AS estimatedRevenue,
             GREATEST(MAX(s.updated_at),MAX(td.updated_at),COALESCE(MAX(o.updated_at),'1970-01-01')) AS dataUpdatedAt
      FROM stores s JOIN tiktok_details td ON td.store_id=s.id JOIN users u ON u.id=s.user_id
      LEFT JOIN store_details sd ON sd.store_id=s.id LEFT JOIN user_details ud ON ud.user_id=u.id
      LEFT JOIN teams t ON t.id=ud.team_id
      LEFT JOIN orders o ON o.shop_code=td.shop_code AND o.platform='tiktok' AND o.order_date>=? AND o.order_date<?
      WHERE s.platform='tiktok' AND ${predicate.sql}
      GROUP BY s.id,s.store_name,sd.account_code,td.shop_code,u.id,u.name,t.name,s.status_id,s.status_member,s.is_auth,s.is_die,s.is_appeal,td.seller_status,td.total_product,td.to_ship,td.ship_late,td.ship_overdue,td.score_star_shop,td.violation
      ORDER BY orders DESC LIMIT 100
    `, [start, end, ...predicate.params]);
    return { domain: "stores", range: this.range(input), data: { rows }, source: this.source(["stores","store_details","tiktok_details","users","teams","orders"], rows[0]?.dataUpdatedAt, ["statusId và sellerStatus cần được đối chiếu bảng mapping nghiệp vụ chính thức trước khi diễn giải bằng nhãn."]) };
  }
}

@Injectable()
export class TiktokFulfillmentTool extends TiktokReadTool {
  readonly id = "tiktok.fulfillment.metrics";
  readonly description = "Volume, chi phí, thiếu giá và tốc độ fulfillment theo xưởng/vendor.";
  constructor(private readonly db: TiktokMysqlService, private readonly scopes: TiktokScopeService) { super(); }

  async execute(input: TiktokToolInput): Promise<TiktokToolOutput> {
    this.scopes.assertDomain(input.scope, "fulfillment");
    const [start, end] = this.window(input); const predicate = this.scopes.orderPredicate(input.scope);
    const rows = await this.db.query<DataRow>(`
      SELECT fu.id AS vendorId, fu.name AS vendorName, COUNT(DISTINCT ofl.order_id) AS orders,
             SUM(COALESCE(od.quantity,0)) AS items, SUM(COALESCE(ofl.fulfill_price,0)) AS fulfillmentCost,
             SUM(CASE WHEN ofl.fulfill_price IS NULL OR ofl.fulfill_price<=0 THEN 1 ELSE 0 END) AS missingPriceRows,
             AVG(TIMESTAMPDIFF(HOUR,o.order_date,ofl.fulfillment_date)) AS averageFulfillmentHours,
             MAX(ofl.updated_at) AS dataUpdatedAt
      FROM order_fulfillments ofl JOIN orders o ON o.order_id=ofl.order_id
      JOIN fulfill_units fu ON fu.id=ofl.fulfillment_unit_id
      LEFT JOIN (SELECT order_id,SUM(quantity) quantity FROM order_details GROUP BY order_id) od ON od.order_id=o.order_id
      WHERE o.platform='tiktok' AND o.order_date>=? AND o.order_date<? AND ${predicate.sql}
      GROUP BY fu.id,fu.name ORDER BY orders DESC
    `, [start, end, ...predicate.params]);
    const missing = rows.reduce((sum,row) => sum + Number(row.missingPriceRows || 0), 0);
    return { domain: "fulfillment", range: this.range(input), data: { rows }, source: this.source(["order_fulfillments","fulfill_units","orders","order_details"], rows[0]?.dataUpdatedAt, missing ? [`Có ${missing} dòng fulfillment thiếu giá hoặc giá bằng 0.`] : []) };
  }
}

@Injectable()
export class TiktokDesignTool extends TiktokReadTool {
  readonly id = "tiktok.design.metrics";
  readonly description = "Backlog, throughput, thời gian làm việc và KPI design theo designer/team.";
  constructor(private readonly db: TiktokMysqlService, private readonly scopes: TiktokScopeService) { super(); }

  async execute(input: TiktokToolInput): Promise<TiktokToolOutput> {
    this.scopes.assertDomain(input.scope, "design");
    const [start, end] = this.window(input);
    const userScope = input.scope.unrestricted ? { sql: "1=1", params: [] as number[] } : this.designScope(input);
    const rows = await this.db.query<DataRow>(`
      SELECT d.designer_id AS designerId, COALESCE(u.name,'Chưa gán designer') AS designerName,
             t.name AS teamName, COUNT(*) AS assigned,
             SUM(d.work_status='completed') AS completed,
             SUM(d.work_status='in_progress') AS inProgress,
             SUM(d.work_status IN ('pending','booked','paused','priority_paused','fix')) AS backlog,
             SUM(d.is_priority=1) AS priorityCount, SUM(COALESCE(d.total_worked_minutes,0)) AS workedMinutes,
             AVG(CASE WHEN d.completed_at IS NOT NULL AND d.booked_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,d.booked_at,d.completed_at) END) AS averageCycleMinutes,
             AVG(NULLIF(d.score,0)) AS averageScore, MAX(d.updated_at) AS dataUpdatedAt
      FROM designs d LEFT JOIN users u ON u.id=d.designer_id
      LEFT JOIN user_details ud ON ud.user_id=u.id LEFT JOIN teams t ON t.id=ud.team_id
      WHERE d.created_at>=? AND d.created_at<? AND ${userScope.sql}
      GROUP BY d.designer_id,u.name,t.name ORDER BY completed DESC,workedMinutes DESC LIMIT 100
    `, [start, end, ...userScope.params]);
    return { domain: "design", range: this.range(input), data: { rows }, source: this.source(["designs","users","user_details","teams"], rows[0]?.dataUpdatedAt, ["Design Spy và design gắn đơn cần được tách theo source/progress khi đánh giá năng suất chính thức."]) };
  }

  private designScope(input: TiktokToolInput): { sql: string; params: number[] } {
    const conditions: string[] = []; const params: number[] = [];
    if (input.scope.userIds.length) { conditions.push(`(d.designer_id IN (${input.scope.userIds.map(() => "?").join(",")}) OR d.user_id_created IN (${input.scope.userIds.map(() => "?").join(",")}))`); params.push(...input.scope.userIds,...input.scope.userIds); }
    if (input.scope.teamIds.length) { conditions.push(`(d.designer_id IN (SELECT user_id FROM user_details WHERE team_id IN (${input.scope.teamIds.map(() => "?").join(",")})) OR d.user_id_created IN (SELECT user_id FROM user_details WHERE team_id IN (${input.scope.teamIds.map(() => "?").join(",")})))`); params.push(...input.scope.teamIds,...input.scope.teamIds); }
    if (input.scope.storeIds.length) { conditions.push(`d.order_id IN (SELECT o_scope.order_id FROM orders o_scope JOIN tiktok_details td_scope ON td_scope.shop_code=o_scope.shop_code WHERE td_scope.store_id IN (${input.scope.storeIds.map(() => "?").join(",")}))`); params.push(...input.scope.storeIds); }
    return { sql: conditions.length ? `(${conditions.join(" OR ")})` : "0=1", params };
  }
}

export type AnyTiktokTool = TiktokOverviewTool | TiktokOrdersTool | TiktokFinanceTool | TiktokTeamTool | TiktokStoresTool | TiktokFulfillmentTool | TiktokDesignTool;
