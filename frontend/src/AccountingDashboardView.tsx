import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, Landmark, ReceiptText, RefreshCw, Scale, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import type { AccountingDashboardData } from "./types";

type Period = "today" | "week" | "month" | "lastMonth" | "custom";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp", PENDING: "Chờ duyệt", PENDING_APPROVAL: "Chờ phê duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối",
  PAID: "Đã thanh toán", CANCELLED: "Đã hủy", OPEN: "Đang mở", PARTIAL: "Đã thu một phần"
};
const STATUS_COLORS = ["#7f2028", "#c6933b", "#526a55", "#8b6f58", "#a13c43", "#55717a"];
const TOOLTIP = { border: "1px solid #ded2c1", borderRadius: 10, background: "#fffdfa", boxShadow: "0 12px 30px rgba(72,42,27,.1)", color: "#443830", fontSize: 11 };

function vnDate(offset = 0) {
  const value = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function periodRange(period: Period) {
  const today = new Date(`${vnDate()}T00:00:00Z`);
  if (period === "today") return { startDate: vnDate(), endDate: vnDate() };
  if (period === "week") return { startDate: vnDate(-6), endDate: vnDate() };
  if (period === "lastMonth") {
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }
  return { startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10), endDate: vnDate() };
}

function vnd(value = 0) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value); }
function integer(value = 0) { return new Intl.NumberFormat("vi-VN").format(value); }
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00Z`)); }
function dateTime(value?: string | null) { return value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "Chưa xác định"; }
function dateOnly(value?: string | null) { return value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "Chưa đặt hạn"; }
function money(value: number, currency = "VND") { return new Intl.NumberFormat(currency === "VND" ? "vi-VN" : "en-US", { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(value); }

export function AccountingDashboardView() {
  const initial = periodRange("month");
  const [period, setPeriod] = useState<Period>("month");
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [data, setData] = useState<AccountingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async (range = { startDate, endDate }) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const nextData = await api.accountingDashboard(range);
      if (requestId === requestSequence.current) setData(nextData);
    }
    catch (cause) {
      if (requestId === requestSequence.current) setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu kế toán");
    }
    finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { void load(initial); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  function selectPeriod(next: Period) {
    setPeriod(next);
    if (next === "custom") return;
    const range = periodRange(next);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    void load(range);
  }

  const trend = useMemo(() => (data?.trend || []).map((row) => ({ ...row, label: shortDate(row.date) })), [data]);
  const categories = useMemo(() => (data?.categories || []).slice(0, 8).map((row) => ({ ...row, total: row.income + row.expense })), [data]);
  const statuses = useMemo(() => (data?.purchaseStatuses || []).map((row, index) => ({ ...row, label: STATUS_LABELS[row.status] || row.status, color: STATUS_COLORS[index % STATUS_COLORS.length] })), [data]);

  return <section className="accounting-dashboard">
    <div className="accounting-toolbar">
      <div className="accounting-periods">
        {[{ id: "today", label: "Hôm nay" }, { id: "week", label: "7 ngày" }, { id: "month", label: "Tháng này" }, { id: "lastMonth", label: "Tháng trước" }].map((item) => <button key={item.id} className={period === item.id ? "active" : ""} onClick={() => selectPeriod(item.id as Period)}>{item.label}</button>)}
        <button className={period === "custom" ? "custom active" : "custom"} onClick={() => setPeriod("custom")}><CalendarDays /> Tùy chọn <ChevronDown /></button>
        {period === "custom" && <div className="accounting-custom-range"><label><span>Từ ngày</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>Đến ngày</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><button onClick={() => void load()}>Áp dụng</button></div>}
      </div>
      <div className="accounting-freshness"><span>Dữ liệu đến {dateTime(data?.source.dataUpdatedAt)} · giờ Việt Nam</span><button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />{loading ? "Đang cập nhật..." : "Phân tích dữ liệu mới"}</button></div>
    </div>

    {error && <div className="accounting-error"><AlertTriangle /><span>{error}</span><button onClick={() => void load()}>Thử lại</button></div>}
    {loading && !data ? <DashboardSkeleton /> : data && <>
      <div className="accounting-ledger">
        <div className="accounting-primary"><span>Dòng tiền ròng</span><strong className={data.summary.netCashFlow < 0 ? "negative" : ""}>{vnd(data.summary.netCashFlow)}</strong><small>{integer(data.summary.transactions)} giao dịch trong kỳ</small></div>
        <Metric icon={<Landmark />} label="Tổng thu" value={vnd(data.summary.income)} detail="Dòng tiền vào đã ghi nhận" tone="positive" />
        <Metric icon={<ReceiptText />} label="Tổng chi" value={vnd(data.summary.expense)} detail="Dòng tiền ra đã ghi nhận" />
        <Metric icon={<Scale />} label="Công nợ chưa thu" value={vnd(data.summary.outstandingReceivables)} detail={`${integer(data.summary.openReceivables)} khoản đang mở`} />
        <Metric icon={<WalletCards />} label="Tài khoản hoạt động" value={integer(data.summary.activeAccounts)} detail="Nguồn thanh toán đang sử dụng" />
      </div>

      <div className="accounting-chart-grid">
        <article className="accounting-panel accounting-trend"><header><div><h2>Thu và chi theo ngày</h2><p>So sánh dòng tiền đã ghi nhận trong kỳ đang xem.</p></div><div className="accounting-chart-legend" aria-label="Chú giải biểu đồ"><span><i className="income" />Thu</span><span><i className="expense" />Chi</span></div></header><div className="accounting-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend}><CartesianGrid stroke="#e8dfd2" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#75695e", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#75695e", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000)}tr`} /><Tooltip contentStyle={TOOLTIP} formatter={(value) => vnd(Number(value))} /><Bar dataKey="income" name="Thu" fill="#526a55" radius={[5, 5, 0, 0]} maxBarSize={32} isAnimationActive={false} /><Bar dataKey="expense" name="Chi" fill="#7f2028" radius={[5, 5, 0, 0]} maxBarSize={32} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></article>
        <article className="accounting-panel accounting-categories"><header><div><h2>Khoản mục lớn</h2><p>Các nhóm có tổng giá trị thu hoặc chi cao nhất.</p></div></header><div className="accounting-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={categories} layout="vertical" margin={{ left: 8 }}><CartesianGrid stroke="#e8dfd2" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={105} tick={{ fill: "#75695e", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} formatter={(value) => vnd(Number(value))} /><Bar dataKey="total" name="Giá trị" fill="#c6933b" radius={[0, 5, 5, 0]} maxBarSize={22} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></article>
      </div>

      <div className="accounting-detail-grid">
        <article className="accounting-panel"><header><div><h2>Yêu cầu mua hàng gần đây</h2><p>Theo dõi giá trị và trạng thái xử lý.</p></div><span>{data.recentPurchases.length} yêu cầu</span></header><div className="accounting-table-wrap"><table><thead><tr><th>Yêu cầu</th><th>Người đề nghị</th><th>Giá trị</th><th>Trạng thái</th></tr></thead><tbody>{data.recentPurchases.map((row) => <tr key={row.id}><td data-label="Yêu cầu"><strong>{row.title}</strong><small>{row.category?.name || row.kind}</small></td><td data-label="Người đề nghị">{row.requester?.fullName || "—"}</td><td data-label="Giá trị"><strong>{money(row.expectedAmount, row.currencyCode)}</strong></td><td data-label="Trạng thái"><span className={`accounting-status status-${row.status.toLowerCase()}`}>{STATUS_LABELS[row.status] || row.status}</span></td></tr>)}</tbody></table>{!data.recentPurchases.length && <EmptyRow text="Chưa có yêu cầu mua hàng trong dữ liệu hiện tại." />}</div></article>
        <article className="accounting-panel"><header><div><h2>Công nợ cần theo dõi</h2><p>Các khoản đang mở hoặc mới thu một phần.</p></div><span>{data.receivables.length} khoản</span></header><div className="accounting-table-wrap"><table><thead><tr><th>Đối tác / nội dung</th><th>Hạn thu</th><th>Còn lại</th><th>Trạng thái</th></tr></thead><tbody>{data.receivables.slice(0, 10).map((row) => <tr key={row.id}><td data-label="Đối tác / nội dung"><strong>{row.partyName}</strong><small>{row.title}</small></td><td data-label="Hạn thu">{dateOnly(row.dueDate)}</td><td data-label="Còn lại"><strong>{vnd(row.outstandingVnd)}</strong><small>Đã thu {vnd(row.paidVnd)}</small></td><td data-label="Trạng thái"><span className={`accounting-status status-${row.status.toLowerCase()}`}>{STATUS_LABELS[row.status] || row.status}</span></td></tr>)}</tbody></table>{!data.receivables.length && <EmptyRow text="Không có công nợ đang mở." />}</div></article>
      </div>

      <article className="accounting-panel accounting-status-panel"><header><div><h2>Trạng thái đề nghị chi</h2><p>Số lượng và tổng giá trị theo từng trạng thái.</p></div></header><div className="accounting-status-list">{statuses.map((row) => <div key={row.status}><i style={{ background: row.color }} /><span><strong>{row.label}</strong><small>{integer(row.count)} yêu cầu</small></span><b>{vnd(row.amount)}</b></div>)}{!statuses.length && <p className="accounting-empty-copy">Chưa có dữ liệu trạng thái.</p>}</div></article>
    </>}
  </section>;
}

function Metric({ icon, label, value, detail, tone = "" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return <div className={`accounting-ledger-metric ${tone}`}><span>{icon}{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function EmptyRow({ text }: { text: string }) { return <div className="accounting-empty-copy">{text}</div>; }
function DashboardSkeleton() { return <div className="accounting-skeleton"><div /><div /><div /><div /><div /><article /><article /></div>; }
