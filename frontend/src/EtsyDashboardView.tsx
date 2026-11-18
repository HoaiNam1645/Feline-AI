import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, CircleDollarSign, Coins, PackageCheck, RefreshCw, RotateCcw, Store, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import type { EtsyDashboardData } from "./types";

type Period = "today" | "yesterday" | "week" | "month" | "lastMonth" | "custom";
type TrendMetric = "orders" | "net" | "profit";

const STATUS_LABELS: Record<string, string> = { NEW: "Đơn mới", DESIGNING: "Thiết kế", READY: "Sẵn sàng", PRODUCING: "Đang sản xuất", SHIPPED: "Đã ship", ON_HOLD: "Tạm giữ", CANCELLED: "Đã hủy", REFUND: "Hoàn tiền" };
const STATUS_COLORS: Record<string, string> = { NEW: "#9b6b2f", DESIGNING: "#6f637f", READY: "#54706a", PRODUCING: "#c18b35", SHIPPED: "#4f7057", ON_HOLD: "#9b713c", CANCELLED: "#9a4248", REFUND: "#b55c45" };
const TOOLTIP = { border: "1px solid #ded2c1", borderRadius: 10, background: "#fffdfa", boxShadow: "0 12px 30px rgba(72,42,27,.1)", color: "#443830", fontSize: 11 };

function vnDate(offset = 0) {
  const value = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function periodRange(period: Period) {
  const today = new Date(`${vnDate()}T00:00:00Z`);
  if (period === "today") return { startDate: vnDate(), endDate: vnDate() };
  if (period === "yesterday") return { startDate: vnDate(-1), endDate: vnDate(-1) };
  if (period === "week") return { startDate: vnDate(-6), endDate: vnDate() };
  if (period === "lastMonth") { const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)); const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }; }
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: vnDate() };
}
function usd(value = 0) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }
function vnd(value = 0) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value); }
function integer(value = 0) { return new Intl.NumberFormat("vi-VN").format(value); }
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00Z`)); }
function dateTime(value: string | null) { return value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "Chưa xác định"; }

export function EtsyDashboardView() {
  const initial = periodRange("week");
  const [period, setPeriod] = useState<Period>("week");
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [teamId, setTeamId] = useState("all");
  const [shopId, setShopId] = useState("all");
  const [sellerId, setSellerId] = useState("all");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("orders");
  const [data, setData] = useState<EtsyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (range = { startDate, endDate }, filters = { teamId, shopId, sellerId }) => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError(null);
    try {
      setData(await api.etsyDashboard({ startDate: range.startDate, endDate: range.endDate, sellerTeamId: filters.teamId, shopId: filters.shopId, sellerId: filters.sellerId }));
      setLastRefreshedAt(new Date());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải tổng quan Etsy"); }
    finally { inFlight.current = false; setLoading(false); }
  }, [startDate, endDate, teamId, shopId, sellerId]);

  useEffect(() => { void load(initial); }, []);
  useEffect(() => { const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000); return () => window.clearInterval(timer); }, [load]);

  function selectPeriod(next: Period) {
    setPeriod(next); if (next === "custom") return;
    const range = periodRange(next); setStartDate(range.startDate); setEndDate(range.endDate); void load(range);
  }
  function applyFilter(kind: "team" | "shop" | "seller", value: string) {
    const next = { teamId, shopId, sellerId, [kind === "team" ? "teamId" : kind === "shop" ? "shopId" : "sellerId"]: value };
    if (kind === "team") { setTeamId(value); setSellerId("all"); next.sellerId = "all"; }
    if (kind === "shop") setShopId(value);
    if (kind === "seller") setSellerId(value);
    void load(undefined, next);
  }
  function resetFilters() { setTeamId("all"); setShopId("all"); setSellerId("all"); void load(undefined, { teamId: "all", shopId: "all", sellerId: "all" }); }

  const statusData = (data?.statuses || []).map((row) => ({ name: STATUS_LABELS[row.status] || row.status, value: row.orders, fill: STATUS_COLORS[row.status] || "#796a5c" }));
  const trend = useMemo(() => (data?.trend || []).map((row) => ({ ...row, label: shortDate(row.date) })), [data]);
  const metricLabel = trendMetric === "orders" ? "Số đơn" : trendMetric === "net" ? "Etsy net" : "Lợi nhuận";
  const metricColor = trendMetric === "orders" ? "#7f2028" : trendMetric === "net" ? "#526a55" : "#b77b24";
  const sellerOptions = (data?.filters.sellers || []).filter((seller) => teamId === "all" || seller.teamId === teamId);

  return <section className="etsy-dashboard">
    <div className="etsy-toolbar">
      <div className="etsy-filter-row">
        <label><span>Team</span><select value={teamId} onChange={(event) => applyFilter("team", event.target.value)}><option value="all">Tất cả team</option>{data?.filters.sellerTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <label><span>Shop</span><select value={shopId} onChange={(event) => applyFilter("shop", event.target.value)}><option value="all">Tất cả shop</option>{data?.filters.shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>
        <label><span>Seller</span><select value={sellerId} onChange={(event) => applyFilter("seller", event.target.value)}><option value="all">Tất cả seller</option>{sellerOptions.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
        {(teamId !== "all" || shopId !== "all" || sellerId !== "all") && <button className="etsy-reset" onClick={resetFilters}><RotateCcw /> Xóa lọc</button>}
      </div>
      <div className="etsy-periods">{[{ id: "today", label: "Hôm nay" }, { id: "yesterday", label: "Hôm qua" }, { id: "week", label: "7 ngày" }, { id: "month", label: "Tháng này" }, { id: "lastMonth", label: "Tháng trước" }].map((item) => <button key={item.id} className={period === item.id ? "active" : ""} onClick={() => selectPeriod(item.id as Period)}>{item.label}</button>)}<button className={period === "custom" ? "custom active" : "custom"} onClick={() => setPeriod("custom")}><CalendarDays /> Tùy chọn <ChevronDown /></button>{period === "custom" && <div className="etsy-custom-range"><label><span>Từ ngày</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>Đến ngày</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><button onClick={() => void load()}>Áp dụng</button></div>}</div>
    </div>
    <div className="etsy-freshness"><span>Dữ liệu đến {dateTime(data?.source.dataUpdatedAt || null)} · giờ Việt Nam</span><button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />{loading ? "Đang lấy dữ liệu..." : "Phân tích dữ liệu mới"}</button></div>
    {error && <div className="etsy-error"><AlertTriangle /><span>{error}</span><button onClick={() => void load()}>Thử lại</button></div>}
    {loading && !data ? <DashboardSkeleton /> : data && <>
      <div className="etsy-ledger">
        <div className="etsy-primary"><span>Lợi nhuận vận hành</span><strong>{usd(data.summary.operationalProfit)}</strong><small>{integer(data.summary.orders)} đơn · {integer(data.summary.items)} sản phẩm</small></div>
        <Metric icon={<Coins />} label="Etsy net" value={usd(data.summary.etsyNet)} detail={`Gross ${usd(data.summary.grossBookedValue)}`} />
        <Metric icon={<PackageCheck />} label="Đơn hàng" value={integer(data.summary.orders)} detail={`${integer(data.summary.items)} sản phẩm`} />
        <Metric icon={<CircleDollarSign />} label="Chi phí vận hành" value={usd(data.summary.fulfillmentCost + data.summary.designCost + data.summary.refundAmount + data.summary.manualCost)} detail={`FF ${usd(data.summary.fulfillmentCost)} · Design ${usd(data.summary.designCost)}`} />
        <Metric icon={<Store />} label="Shop hoạt động" value={integer(data.summary.shops)} detail={`${integer(data.summary.activeSellers)} seller có dữ liệu`} />
      </div>
      <div className="etsy-support-ledger"><span><small>Doanh thu ghi nhận</small><strong>{usd(data.summary.recognizedRevenue)}</strong></span><span><small>Refund</small><strong>{usd(data.summary.refundAmount)}</strong></span><span><small>Funds về tài khoản</small><strong>{usd(data.summary.funds)}</strong><em>{data.summary.fundsVnd > 0 ? vnd(data.summary.fundsVnd) : ""}</em></span><span><small>Tỷ lệ gán seller</small><strong>{data.quality.attributionRate}%</strong></span></div>
      <div className="etsy-chart-grid">
        <article className="etsy-panel trend"><header><div><h2>Nhịp kinh doanh theo ngày</h2><p>Theo dõi đơn, Etsy net hoặc lợi nhuận trong kỳ.</p></div><div className="etsy-metric-tabs">{(["orders", "net", "profit"] as TrendMetric[]).map((item) => <button key={item} className={trendMetric === item ? "active" : ""} onClick={() => setTrendMetric(item)}>{item === "orders" ? "Đơn" : item === "net" ? "Net" : "Lợi nhuận"}</button>)}</div></header><div className="etsy-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend}><CartesianGrid stroke="#e8dfd2" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#75695e", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#75695e", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} formatter={(value) => trendMetric === "orders" ? integer(Number(value)) : usd(Number(value))} /><Bar dataKey={trendMetric} name={metricLabel} fill={metricColor} radius={[6, 6, 0, 0]} maxBarSize={38} /></BarChart></ResponsiveContainer></div></article>
        <article className="etsy-panel statuses"><header><div><h2>Trạng thái đơn</h2><p>Phân bổ công việc đang có trong kỳ.</p></div></header><div className="etsy-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} layout="vertical" margin={{ left: 8 }}><CartesianGrid stroke="#e8dfd2" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={88} tick={{ fill: "#75695e", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Bar dataKey="value" name="Số đơn" radius={[0, 6, 6, 0]}>{statusData.map((item) => <Cell key={item.name} fill={item.fill} />)}</Bar></BarChart></ResponsiveContainer></div></article>
      </div>
      <div className="etsy-ranking-grid">
        <RankingTable title="Xếp hạng seller" subtitle="Sắp xếp theo lợi nhuận vận hành." rows={data.sellers} kind="seller" />
        <RankingTable title="Hiệu suất shop" subtitle="Đơn, net và lợi nhuận theo shop." rows={data.shops} kind="shop" />
      </div>
      <article className="etsy-panel etsy-products"><header><div><h2>Sản phẩm nổi bật</h2><p>Xếp theo Etsy net trong phạm vi đang xem.</p></div><span>{data.topProducts.length} sản phẩm</span></header><div className="etsy-table-wrap"><table><thead><tr><th>Sản phẩm</th><th>Shop</th><th>Số lượng</th><th>Gross</th><th>Etsy net</th></tr></thead><tbody>{data.topProducts.slice(0, 12).map((row, index) => <tr key={`${row.shopId}-${row.name}`}><td><b>{index + 1}</b><strong>{row.name}</strong></td><td>{row.shopName}</td><td>{integer(row.quantity)}</td><td>{usd(row.grossBookedValue)}</td><td className="positive"><strong>{usd(row.net)}</strong></td></tr>)}</tbody></table></div></article>
      {(data.quality.fallbackNetOrders > 0 || data.quality.unattributedOrders > 0) && <div className="etsy-quality"><AlertTriangle /><div><strong>Cần rà soát chất lượng dữ liệu</strong><span>{integer(data.quality.fallbackNetOrders)} đơn đang dùng net ước tính · {integer(data.quality.unattributedOrders)} đơn chưa gán đủ seller.</span></div></div>}
    </>}
  </section>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="etsy-ledger-metric"><span>{icon}{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function RankingTable({ title, subtitle, rows, kind }: { title: string; subtitle: string; rows: EtsyDashboardData["sellers"] | EtsyDashboardData["shops"]; kind: "seller" | "shop" }) { return <article className="etsy-panel etsy-ranking"><header><div><h2>{title}</h2><p>{subtitle}</p></div><span>{rows.length} {kind === "seller" ? "seller" : "shop"}</span></header><div className="etsy-table-wrap"><table><thead><tr><th>{kind === "seller" ? "Seller" : "Shop"}</th>{kind === "seller" && <th>Team</th>}<th>Đơn</th><th>Net</th><th>Lợi nhuận</th></tr></thead><tbody>{rows.slice(0, 15).map((row, index) => <tr key={row.id}><td><b>{index + 1}</b><strong>{row.name}</strong></td>{kind === "seller" && <td>{"teamName" in row ? row.teamName : ""}</td>}<td>{integer(row.orders)}</td><td>{usd(row.net)}</td><td className={row.profit >= 0 ? "positive" : "negative"}><strong>{usd(row.profit)}</strong></td></tr>)}</tbody></table></div></article>; }
function DashboardSkeleton() { return <div className="etsy-skeleton"><div /><div /><div /><div /><article /><article /></div>; }
