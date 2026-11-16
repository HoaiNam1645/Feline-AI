import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, CircleDollarSign, PackageCheck, RefreshCw, ShoppingBag, Store, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import type { TiktokDashboardData } from "./types";

type Period = "today" | "yesterday" | "week" | "month" | "lastMonth" | "custom";

function laDate(offset = 0) {
  const value = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function periodRange(period: Period) {
  const today = new Date(`${laDate()}T00:00:00Z`);
  if (period === "today") return { startDate: laDate(), endDate: laDate() };
  if (period === "yesterday") return { startDate: laDate(-1), endDate: laDate(-1) };
  if (period === "week") return { startDate: laDate(-6), endDate: laDate() };
  if (period === "lastMonth") {
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: laDate() };
}

function usd(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }
function integer(value: number) { return new Intl.NumberFormat("vi-VN").format(value); }
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00Z`)); }
function dateTime(value: string | null) { return value ? `${new Intl.DateTimeFormat("vi-VN", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value))} PT` : "Chưa xác định"; }

const TOOLTIP = { border: "1px solid #ded2c1", borderRadius: 10, background: "#fffdfa", boxShadow: "0 12px 30px rgba(72,42,27,.1)", color: "#443830", fontSize: 11 };

export function TiktokDashboardView() {
  const [period, setPeriod] = useState<Period>("week");
  const initial = periodRange("week");
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [teamId, setTeamId] = useState<number | "all">("all");
  const [data, setData] = useState<TiktokDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const requestInFlight = useRef(false);

  const load = useCallback(async (nextStart = startDate, nextEnd = endDate) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true); setError(null);
    try {
      setData(await api.tiktokDashboard(nextStart, nextEnd));
      setLastRefreshedAt(new Date());
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải tổng quan TikTok"); }
    finally { requestInFlight.current = false; setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { void load(initial.startDate, initial.endDate); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  function selectPeriod(value: Period) {
    setPeriod(value);
    if (value === "custom") return;
    const range = periodRange(value); setStartDate(range.startDate); setEndDate(range.endDate); void load(range.startDate, range.endDate);
  }

  const teams = data?.teams.filter((team) => teamId === "all" || team.id === teamId) || [];
  const sellers = data?.sellers.filter((seller) => teamId === "all" || seller.teamId === teamId) || [];
  const sum = (key: "orders" | "fulfilledOrders" | "items" | "estimatedRevenue" | "fulfillmentCost" | "refundAmount" | "adsSpend" | "contribution") => teams.reduce((total, team) => total + team[key], 0);
  const stores = teams.reduce((total, team) => total + team.stores.total, 0);
  const healthyStores = teams.reduce((total, team) => total + team.stores.healthy, 0);
  const statusData = [
    { name: "Đã fulfill", value: teams.reduce((n, team) => n + team.statuses.fulfilled, 0), fill: "#526a55" },
    { name: "Đang chờ", value: teams.reduce((n, team) => n + team.statuses.pending, 0), fill: "#c6933b" },
    { name: "Tạm giữ", value: teams.reduce((n, team) => n + team.statuses.onHold, 0), fill: "#9a6518" },
    { name: "Đã hủy", value: teams.reduce((n, team) => n + team.statuses.cancelled, 0), fill: "#a13c43" }
  ];
  const trend = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>();
    for (const item of data?.trend || []) {
      if (teamId !== "all" && item.teamId !== teamId) continue;
      const row = rows.get(item.reportDate) || { reportDate: item.reportDate, label: shortDate(item.reportDate) };
      row[item.teamName] = item.orders; rows.set(item.reportDate, row);
    }
    return [...rows.values()];
  }, [data, teamId]);

  return <section className="tiktok-dashboard">
    <div className="tiktok-dashboard-toolbar">
      <div className="tiktok-team-switch" aria-label="Chọn team">
        <button className={teamId === "all" ? "active" : ""} onClick={() => setTeamId("all")}>Cả hai team</button>
        {data?.teams.map((team) => <button key={team.id} className={teamId === team.id ? "active" : ""} onClick={() => setTeamId(team.id)}>{team.name.replace(/\s+Team$/i, "")}</button>)}
      </div>
      <div className="tiktok-periods">
        {[{ id: "today", label: "Hôm nay" }, { id: "yesterday", label: "Hôm qua" }, { id: "week", label: "7 ngày" }, { id: "month", label: "Tháng này" }, { id: "lastMonth", label: "Tháng trước" }].map((item) => <button key={item.id} className={period === item.id ? "active" : ""} onClick={() => selectPeriod(item.id as Period)}>{item.label}</button>)}
        <button className={period === "custom" ? "custom active" : "custom"} onClick={() => setPeriod("custom")}><CalendarDays /> Tùy chọn <ChevronDown /></button>
        {period === "custom" && <div className="tiktok-custom-range"><label><span>Từ ngày</span><input aria-label="Từ ngày" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>Đến ngày</span><input aria-label="Đến ngày" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><button className="apply" onClick={() => void load()}>Áp dụng</button></div>}
      </div>
      <div className="tiktok-fresh-data">
        <span>{lastRefreshedAt ? `Vừa lấy dữ liệu lúc ${lastRefreshedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Tự động cập nhật mỗi 60 giây"}</span>
        <button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />{loading ? "Đang phân tích..." : "Phân tích dữ liệu mới"}</button>
      </div>
    </div>

    <div className="tiktok-timezone">Các mốc “Hôm nay”, “Hôm qua” và thời điểm cập nhật được tính theo giờ Los Angeles (PT).</div>
    {error && <div className="tiktok-dashboard-error"><AlertTriangle /> <span>{error}</span><button onClick={() => void load()}>Thử lại</button></div>}
    {loading && !data ? <DashboardSkeleton /> : <>
      <div className="tiktok-ledger">
        <div className="tiktok-primary-metric"><span>Contribution sau chi phí</span><strong>{usd(sum("contribution"))}</strong><small>{integer(sum("orders"))} đơn · {integer(sum("items"))} sản phẩm</small></div>
        <Metric icon={<CircleDollarSign />} label="Doanh thu ước tính" value={usd(sum("estimatedRevenue"))} detail={`Fulfillment ${usd(sum("fulfillmentCost"))}`} />
        <Metric icon={<PackageCheck />} label="Đơn đã fulfill" value={`${integer(sum("fulfilledOrders"))}/${integer(sum("orders"))}`} detail={`${sum("orders") ? Math.round(sum("fulfilledOrders") / sum("orders") * 100) : 0}% tổng đơn`} />
        <Metric icon={<Store />} label="Store TikTok" value={integer(stores)} detail={`${healthyStores} đang hoạt động ổn định`} />
        <Metric icon={<Users />} label="Seller có dữ liệu" value={integer(sellers.length)} detail={teams.map((team) => team.name.replace(/\s+Team$/i, "")).join(" · ")} />
      </div>

      <div className="tiktok-dashboard-grid">
        <article className="tiktok-chart-panel trend-panel"><header><div><h2>Nhịp đơn theo ngày</h2><p>So sánh sản lượng giữa hai team trong kỳ đã chọn.</p></div><span>Dữ liệu đến {dateTime(data?.source.dataUpdatedAtUtc || null)}</span></header><div className="tiktok-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend} barGap={4}><CartesianGrid stroke="#e8dfd2" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#75695e", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#75695e", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Legend />{teams.map((team, index) => <Bar key={team.id} dataKey={team.name} fill={index ? "#526a55" : "#7f2028"} radius={[5, 5, 0, 0]} maxBarSize={34} />)}</BarChart></ResponsiveContainer></div></article>
        <article className="tiktok-chart-panel status-panel"><header><div><h2>Trạng thái đơn</h2><p>Các trạng thái vận hành cần theo dõi.</p></div></header><div className="tiktok-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} layout="vertical" margin={{ left: 10 }}><CartesianGrid stroke="#e8dfd2" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={75} tick={{ fill: "#75695e", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Bar dataKey="value" name="Số đơn" radius={[0, 6, 6, 0]}>{statusData.map((item) => <Cell key={item.name} fill={item.fill} />)}</Bar></BarChart></ResponsiveContainer></div><div className="status-ledger">{statusData.map((item) => <span key={item.name}><i style={{ background: item.fill }} />{item.name}<strong>{integer(item.value)}</strong></span>)}</div></article>
      </div>

      <article className="tiktok-seller-panel"><header><div><h2>Hiệu suất seller</h2><p>Xếp theo contribution sau fulfillment, refund và ads.</p></div><span>{sellers.length} seller</span></header><div className="tiktok-table-wrap"><table><thead><tr><th>Seller</th><th>Team</th><th>Đơn FF / Tổng</th><th>Item</th><th>Doanh thu</th><th>Fulfillment</th><th>Refund</th><th>Ads</th><th>Contribution</th></tr></thead><tbody>{[...sellers].sort((a,b) => b.contribution-a.contribution).map((seller) => <tr key={seller.sellerId}><td><div className="seller-name"><span>{seller.sellerName.split(/\s+/).slice(-2).map((part) => part[0]).join("")}</span><strong>{seller.sellerName}</strong></div></td><td><em>{seller.teamName.replace(/\s+Team$/i, "")}</em></td><td><b>{integer(seller.fulfilledOrders)}</b> / {integer(seller.orders)}</td><td>{integer(seller.items)}</td><td>{usd(seller.estimatedRevenue)}</td><td>{usd(seller.fulfillmentCost)}</td><td className={seller.refundAmount > 0 ? "negative" : ""}>{usd(seller.refundAmount)}</td><td>{usd(seller.adsSpend)}</td><td className={seller.contribution >= 0 ? "positive" : "negative"}><strong>{usd(seller.contribution)}</strong></td></tr>)}</tbody><tfoot><tr><td colSpan={2}>Tổng kỳ đã chọn</td><td>{integer(sum("fulfilledOrders"))} / {integer(sum("orders"))}</td><td>{integer(sum("items"))}</td><td>{usd(sum("estimatedRevenue"))}</td><td>{usd(sum("fulfillmentCost"))}</td><td>{usd(sum("refundAmount"))}</td><td>{usd(sum("adsSpend"))}</td><td>{usd(sum("contribution"))}</td></tr></tfoot></table>{!sellers.length && <div className="tiktok-empty"><ShoppingBag /><span>Chưa có dữ liệu seller trong kỳ này.</span></div>}</div></article>
    </>}
  </section>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="tiktok-ledger-metric"><span>{icon}{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function DashboardSkeleton() { return <div className="tiktok-dashboard-skeleton"><div /><div /><div /><div /><article /><article /></div>; }
