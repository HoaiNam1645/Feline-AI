import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, AlertTriangle, BarChart3, Bot, Boxes, BrainCircuit,
  CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleDot,
  ClipboardList, Database, Eye, EyeOff, FileText, Gauge, KeyRound,
  LockKeyhole, LogOut, Menu, PackageCheck, Play, RefreshCw, Search,
  Settings2, ShieldCheck, Sparkles, UserRound, Users, X, MessageCircle,
  DollarSign, Trophy, BookOpen, Calculator
  , CircleHelp, Building2, ClipboardCheck
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { AdminUsersView } from "./AdminUsersView";
import { LemiexChatView } from "./LemiexChatView";
import { AdminQuestionsView } from "./AdminQuestionsView";
import { KnowledgeHubView } from "./KnowledgeHubView";
import { CeoChatView } from "./CeoChatView";
import { TiktokDashboardView } from "./TiktokDashboardView";
import { EtsyDashboardView } from "./EtsyDashboardView";
import { AccountingDashboardView } from "./AccountingDashboardView";
import { TaskManagerView } from "./TaskManagerView";
import { DailyReportsView } from "./DailyReportsView";
import { NotificationBell } from "./NotificationBell";
import { MultiAgentMeetingView } from "./MultiAgentMeetingView";
import type {
  AccessAction,
  AgentDefinition,
  AgentRun,
  AuthSession,
  DailyMetrics,
  MultiAgentId
} from "./types";

type View = "common" | "tasks" | "dailyReports" | "multiAgent" | "office" | "activity" | "lemiex" | "chat" | "ceoChat" | "tiktokDashboard" | "tiktokChat" | "etsyDashboard" | "etsyChat" | "accountingDashboard" | "accountingChat" | "reports" | "backlog" | "users" | "questions" | "knowledge" | "tiktokKnowledge" | "etsyKnowledge" | "accountingKnowledge" | "audit" | "sources";
const VIEW_PATHS: Record<View, string> = {
  common: "/overview",
  tasks: "/tasks",
  dailyReports: "/daily-reports",
  multiAgent: "/multi-agent",
  office: "/office",
  activity: "/activity",
  lemiex: "/agents/lemiex",
  chat: "/agents/lemiex/chat",
  ceoChat: "/agents/ceo/chat",
  tiktokDashboard: "/agents/tiktok/overview",
  tiktokChat: "/agents/tiktok/chat",
  etsyDashboard: "/agents/etsy/overview",
  etsyChat: "/agents/etsy/chat",
  accountingDashboard: "/agents/accounting/overview",
  accountingChat: "/agents/accounting/chat",
  reports: "/agents/lemiex/reports",
  backlog: "/agents/lemiex/backlog",
  users: "/admin/users",
  questions: "/admin/questions",
  knowledge: "/admin/knowledge",
  tiktokKnowledge: "/admin/knowledge/tiktok",
  etsyKnowledge: "/admin/knowledge/etsy",
  accountingKnowledge: "/admin/knowledge/accounting",
  audit: "/admin/audit",
  sources: "/admin/sources"
};
const PATH_VIEWS = Object.fromEntries(Object.entries(VIEW_PATHS).map(([view, path]) => [path, view])) as Record<string, View>;
const DATE_VIEWS = new Set<View>(["lemiex", "reports", "backlog"]);
const METRIC_VIEWS = new Set<View>([...DATE_VIEWS, "sources"]);
const PRODUCT_COLORS = ["#7f2028", "#3f624b", "#9a6518", "#a95436", "#685b73", "#55717a", "#77634d", "#8c4d57"];
const CHART_TOOLTIP_STYLE = { border: "1px solid #ded2c1", borderRadius: 10, background: "#fffdfa", boxShadow: "0 12px 30px rgba(72,42,27,.1)", color: "#443830", fontSize: 11 };
const AiOfficeView = lazy(() => import("./AiOfficeView").then((module) => ({ default: module.AiOfficeView })));

function categoryColor(value: string) {
  const hash = [...value].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 0);
  return PRODUCT_COLORS[hash % PRODUCT_COLORS.length];
}

function ageBandColor(value: string) {
  if (value.includes(">=72") || value.includes("≥72")) return "#a13c43";
  if (value.includes("48-72")) return "#9a6518";
  if (value.includes("24-48")) return "#8a7550";
  return "#3f624b";
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`)));
}

function formatDate(date?: string) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(`${date}T00:00:00`));
}

function formatTime(date?: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
    .format(new Date(date));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function compactUsd(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 1 }).format(value);
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function extractMetrics(run?: AgentRun): DailyMetrics | undefined {
  return run?.toolCalls.find((call) => call.toolId === "lemiex.metrics.daily-snapshot")?.output?.metrics;
}

function extractReport(run?: AgentRun) {
  return run?.toolCalls.find((call) => call.toolId === "lemiex.reports.daily-artifact")?.output?.content;
}

function canAccess(
  session: AuthSession,
  action: AccessAction,
  options: { agentId?: string; capabilityId?: string; dataScopeId?: string } = {}
) {
  if (session.access.platformAdmin) return true;
  const includesAccess = (values: string[], expected: string) => values.includes("*") || values.includes(expected);
  return session.access.grants.some((grant) => {
    if (options.agentId && grant.agentId !== options.agentId) return false;
    if (!includesAccess(grant.actions, action)) return false;
    if (options.capabilityId && !includesAccess(grant.capabilityIds, options.capabilityId)) return false;
    if (options.dataScopeId && !includesAccess(grant.dataScopeIds, options.dataScopeId)) return false;
    return true;
  });
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    void api.me()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setCheckingSession(false));
    const expire = () => setSession(null);
    window.addEventListener("feline:session-expired", expire);
    return () => window.removeEventListener("feline:session-expired", expire);
  }, []);

  async function login(email: string, password: string) {
    await api.login(email, password);
    setSession(await api.me());
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setSession(null);
    }
  }

  if (checkingSession) return <SessionLoader />;
  if (!session) return <LoginScreen onLogin={login} />;
  return <PlatformApp session={session} onLogout={logout} onSessionEnded={() => setSession(null)} />;
}

function PlatformApp({
  session,
  onLogout,
  onSessionEnded
}: {
  session: AuthSession;
  onLogout: () => Promise<void>;
  onSessionEnded: () => void;
}) {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [definition, setDefinition] = useState<AgentDefinition | null>(null);
  const [directMetrics, setDirectMetrics] = useState<DailyMetrics>();
  const [directReport, setDirectReport] = useState<string>();
  const [systemOnline, setSystemOnline] = useState(false);
  const [sourceOnline, setSourceOnline] = useState(false);
  const [defaultDate, setDefaultDate] = useState(todayInVietnam());
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    if (session.user.passwordResetRequired) setPasswordOpen(true);
  }, [session.user.passwordResetRequired]);

  const isAdmin = session.user.role === "ADMIN";
  const hasLemiex = session.access.platformAdmin
    || session.access.grants.some((grant) => grant.agentId === "lemiex-ai");
  const hasCeo = session.access.platformAdmin
    || session.access.grants.some((grant) => grant.agentId === "ceo-ai");
  const hasTiktok = session.access.platformAdmin
    || session.access.grants.some((grant) => grant.agentId === "tiktok-ai");
  const hasEtsy = session.access.platformAdmin
    || session.access.grants.some((grant) => grant.agentId === "etsy-ai");
  const hasAccounting = session.access.platformAdmin
    || session.access.grants.some((grant) => grant.agentId === "accounting-ai");
  const lemiexOnly = !session.access.platformAdmin && hasLemiex && !hasCeo && !hasTiktok && !hasEtsy && !hasAccounting;
  const canViewBasic = canAccess(session, "view", {
    agentId: "lemiex-ai",
    dataScopeId: "lemiex.operations.basic"
  });
  const canRunDaily = canAccess(session, "run", {
    agentId: "lemiex-ai",
    capabilityId: "lemiex.operations.daily-review",
    dataScopeId: "lemiex.operations.basic"
  });
  const canRunChat = canAccess(session, "run", {
    agentId: "lemiex-ai",
    capabilityId: "lemiex.operations.ask",
    dataScopeId: "lemiex.operations.basic"
  });
  const canRunCeoChat = canAccess(session, "run", {
    agentId: "ceo-ai",
    capabilityId: "ceo.hr.ask",
    dataScopeId: "ceo.hr.knowledge"
  });
  const canRunTiktokChat = canAccess(session, "run", {
    agentId: "tiktok-ai",
    capabilityId: "tiktok.knowledge.ask",
    dataScopeId: "tiktok.knowledge"
  });
  const canRunEtsyChat = canAccess(session, "run", {
    agentId: "etsy-ai",
    capabilityId: "etsy.knowledge.ask",
    dataScopeId: "etsy.knowledge"
  });
  const canRunAccountingChat = canAccess(session, "run", {
    agentId: "accounting-ai",
    capabilityId: "accounting.knowledge.ask",
    dataScopeId: "accounting.knowledge"
  }) || canAccess(session, "run", {
    agentId: "accounting-ai",
    capabilityId: "accounting.data.ask"
  });
  const canCoordinateAgents = canAccess(session, "run", { agentId: "ceo-ai" });
  const availableMultiAgentIds = [
    canCoordinateAgents && "ceo-ai",
    canAccess(session, "run", { agentId: "tiktok-ai" }) && "tiktok-ai",
    canAccess(session, "run", { agentId: "etsy-ai" }) && "etsy-ai",
    canAccess(session, "run", { agentId: "lemiex-ai" }) && "lemiex-ai"
  ].filter(Boolean) as MultiAgentId[];
  const canViewTiktokDashboard = canAccess(session, "view", {
    agentId: "tiktok-ai",
    capabilityId: "tiktok.data.ask"
  });
  const canViewEtsyDashboard = canAccess(session, "view", {
    agentId: "etsy-ai",
    capabilityId: "etsy.data.ask"
  });
  const canViewAccountingDashboard = canAccess(session, "view", {
    agentId: "accounting-ai",
    capabilityId: "accounting.data.ask"
  });
  const canViewAudit = canAccess(session, "view_audit", {
    agentId: "lemiex-ai",
    dataScopeId: "lemiex.operations.audit"
  });
  const view = PATH_VIEWS[location.pathname];
  const selectedDate = validDate(searchParams.get("date")) ? searchParams.get("date")! : defaultDate;
  const canOpenView = view && ({
    common: true,
    tasks: true,
    dailyReports: true,
    multiAgent: canCoordinateAgents && availableMultiAgentIds.length > 1,
    office: canViewBasic || (canRunCeoChat && canViewBasic) || canRunTiktokChat,
    activity: canViewAudit,
    lemiex: hasLemiex,
    chat: canRunChat,
    ceoChat: canRunCeoChat,
    tiktokDashboard: canViewTiktokDashboard,
    tiktokChat: canRunTiktokChat,
    etsyDashboard: canViewEtsyDashboard,
    etsyChat: canRunEtsyChat,
    accountingDashboard: canViewAccountingDashboard,
    accountingChat: canRunAccountingChat,
    reports: canViewBasic,
    backlog: canViewBasic,
    users: isAdmin,
    questions: isAdmin,
    knowledge: isAdmin,
    tiktokKnowledge: isAdmin,
    etsyKnowledge: isAdmin,
    accountingKnowledge: isAdmin,
    audit: canViewAudit,
    sources: isAdmin
  } satisfies Record<View, boolean>)[view];

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [health, source, agent, runList] = await Promise.allSettled([
        api.health(),
        isAdmin ? api.sourceHealth() : Promise.resolve(null),
        hasLemiex ? api.definition() : Promise.resolve(null),
        canViewAudit ? api.runs() : Promise.resolve([])
      ]);
      setSystemOnline(health.status === "fulfilled" && health.value.status === "ok");
      setSourceOnline(source.status === "fulfilled" && source.value !== null);
      if (agent.status === "fulfilled" && agent.value) setDefinition(agent.value);
      if (runList.status === "fulfilled") setRuns(runList.value);
      const latestRuns = runList.status === "fulfilled" ? runList.value : [];
      setDefaultDate(latestRuns.find((run) => run.input?.reportDate)?.input.reportDate || todayInVietnam());
      if ([health, agent, runList].some((result) => result.status === "rejected")) {
        setError("Một phần dữ liệu nền tảng chưa tải được. Các dịch vụ còn lại vẫn hiển thị bình thường.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selectedDate || !canViewBasic || !METRIC_VIEWS.has(view)) {
      setDirectMetrics(undefined);
      setDirectReport(undefined);
      return;
    }
    void Promise.allSettled([
      api.dailyMetrics(selectedDate),
      api.dailyReport(selectedDate)
    ]).then(([metricsResult, reportResult]) => {
      setDirectMetrics(metricsResult.status === "fulfilled" ? metricsResult.value : undefined);
      setDirectReport(reportResult.status === "fulfilled" ? reportResult.value?.content : undefined);
    });
  }, [selectedDate, canViewBasic, view]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.input?.reportDate === selectedDate && run.status === "COMPLETED")
      || runs.find((run) => run.input?.reportDate === selectedDate),
    [runs, selectedDate]
  );
  const metrics = directMetrics || extractMetrics(selectedRun);
  const report = extractReport(selectedRun) || directReport;
  const review = selectedRun?.output;

  async function runAnalysis() {
    if (!selectedDate || !canRunDaily) return;
    setRunning(true);
    setError(null);
    try {
      const result = await api.runDailyReview(selectedDate);
      setRuns((current) => [result, ...current]);
      navigate("lemiex");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể chạy Lemiex AI");
    } finally {
      setRunning(false);
    }
  }

  function navigate(next: View) {
    const search = DATE_VIEWS.has(next) && selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : "";
    routerNavigate(`${VIEW_PATHS[next]}${search}`);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setSelectedDate(value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set("date", value);
      else next.delete("date");
      return next;
    });
  }

  if (!view || !canOpenView) return <Navigate to={VIEW_PATHS.common} replace />;

  const title = {
    common: isAdmin ? ["Tổng quan", "Toàn bộ hệ thống AI"] : ["Tổng quan", lemiexOnly ? "Không gian Lemiex" : "Không gian làm việc"], tasks: ["Điều hành", "Quản lý công việc"], dailyReports: ["Điều hành", "Báo cáo hằng ngày"], multiAgent: ["Điều hành", "Phòng điều hành AI"], office: [lemiexOnly ? "Lemiex" : "Không gian AI", lemiexOnly ? "Xưởng vận hành 3D" : "Văn phòng liên công ty"], activity: ["Hoạt động", "Luồng xử lý gần đây"],
    lemiex: ["Lemiex AI", "Tổng quan vận hành xưởng"], chat: ["Lemiex AI", "Hỏi đáp vận hành"], ceoChat: ["CEO AI", "Tri thức nội bộ"], tiktokDashboard: ["TikTok AI", "Tổng quan G9B & CashStorm"], tiktokChat: ["TikTok AI", "Hỏi đáp Sell TikTok"], etsyDashboard: ["Etsy AI", "Tổng quan kinh doanh Etsy"], etsyChat: ["Etsy AI", "Hỏi đáp Sell Etsy"], accountingDashboard: ["Kế toán AI", "Tổng quan tài chính"], accountingChat: ["Kế toán AI", "Hỏi đáp kế toán"], reports: ["Lemiex AI", "Báo cáo vận hành"],
    backlog: ["Lemiex AI", "Theo dõi backlog"], users: ["Quản trị", "Người dùng & phân quyền"], questions: ["Quản trị", "Câu hỏi cần bổ sung"], knowledge: ["CEO AI", "Kho tri thức nội bộ"], tiktokKnowledge: ["TikTok AI", "Kho tri thức Sell TikTok"], etsyKnowledge: ["Etsy AI", "Kho tri thức Sell Etsy"], accountingKnowledge: ["Kế toán AI", "Kho tri thức Kế toán"], audit: [isAdmin ? "Quản trị" : "Theo dõi", isAdmin ? "Nhật ký AI" : "Lịch sử hoạt động"],
    sources: ["Hệ thống", "Nguồn dữ liệu"]
  }[view];

  return <div className={`platform-shell role-${session.user.role.toLowerCase()} view-${view}`}>
    <aside className={`light-sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="platform-brand"><div className="logo-orbit"><BrainCircuit /></div><div><strong>Feline AI</strong><span>{isAdmin ? "Intelligence Platform" : "Trợ lý công việc"}</span></div><button className="mobile-close" onClick={() => setSidebarOpen(false)}><X /></button></div>
      <div className="sidebar-scroll">
        <nav className="tree-nav">
          <NavGroup label={isAdmin ? "Nền tảng" : "Chung"}>
            <NavButton active={view === "common"} icon={<Gauge />} label="Tổng quan chung" onClick={() => navigate("common")} />
            <NavButton active={view === "tasks"} icon={<ClipboardCheck />} label="Công việc phòng ban" onClick={() => navigate("tasks")} />
            <NavButton active={view === "dailyReports"} icon={<CalendarDays />} label="Báo cáo hằng ngày" onClick={() => navigate("dailyReports")} />
            {canCoordinateAgents && availableMultiAgentIds.length > 1 && <NavButton active={view === "multiAgent"} icon={<Users />} label="Phòng điều hành AI" onClick={() => navigate("multiAgent")} />}
            {(canViewBasic || (canRunCeoChat && canViewBasic) || canRunTiktokChat) && <NavButton active={view === "office"} icon={<Building2 />} label={lemiexOnly ? "Xưởng Lemiex 3D" : "Văn phòng AI"} onClick={() => navigate("office")} />}
            {canViewAudit && <NavButton active={view === "activity"} icon={<Activity />} label="Hoạt động AI" badge={String(runs.length)} onClick={() => navigate("activity")} />}
          </NavGroup>
          {(hasLemiex || hasCeo || hasTiktok || hasEtsy || hasAccounting) && <NavGroup label={isAdmin ? "Không gian AI" : "Trợ lý AI"}>
            {hasLemiex && <div className={`agent-nav-cluster ${["lemiex", "chat", "reports", "backlog"].includes(view) ? "current" : ""}`}>
              <button className={`nav-parent ${["lemiex", "chat", "reports", "backlog"].includes(view) ? "active" : ""}`} onClick={() => setAgentsOpen((value) => !value)}><span className="agent-dot lemiex"><Bot /></span><span><strong>Lemiex AI</strong><small>Vận hành xưởng</small></span>{agentsOpen ? <ChevronDown /> : <ChevronRight />}</button>
              {agentsOpen && <div className="subnav">
                <NavButton compact active={view === "lemiex"} icon={<Gauge />} label="Tổng quan" onClick={() => navigate("lemiex")} />
                {canRunChat && <NavButton compact active={view === "chat"} icon={<MessageCircle />} label="Hỏi đáp" onClick={() => navigate("chat")} />}
                {canViewBasic && <NavButton compact active={view === "reports"} icon={<FileText />} label="Báo cáo" onClick={() => navigate("reports")} />}
                {canViewBasic && <NavButton compact active={view === "backlog"} icon={<Boxes />} label="Backlog" onClick={() => navigate("backlog")} />}
              </div>}
            </div>}
            {hasCeo && <div className={`agent-nav-cluster ${view === "ceoChat" ? "current" : ""}`}>
              <button className={`nav-parent ${view === "ceoChat" ? "active" : ""}`} onClick={() => navigate("ceoChat")}><span className="agent-dot sales"><Bot /></span><span><strong>CEO AI</strong><small>Tri thức nội bộ</small></span><ChevronRight /></button>
            </div>}
            {hasTiktok && <div className={`agent-nav-cluster ${view === "tiktokChat" || view === "tiktokDashboard" ? "current" : ""}`}>
              <button className={`nav-parent ${view === "tiktokChat" || view === "tiktokDashboard" ? "active" : ""}`} onClick={() => navigate(canViewTiktokDashboard ? "tiktokDashboard" : "tiktokChat")}><span className="agent-dot tiktok"><Bot /></span><span><strong>TikTok AI</strong><small>Phòng Sell TikTok</small></span><ChevronRight /></button>
              <div className="subnav">
                {canViewTiktokDashboard && <NavButton compact active={view === "tiktokDashboard"} icon={<Gauge />} label="Tổng quan" onClick={() => navigate("tiktokDashboard")} />}
                {canRunTiktokChat && <NavButton compact active={view === "tiktokChat"} icon={<MessageCircle />} label="Hỏi đáp" onClick={() => navigate("tiktokChat")} />}
              </div>
            </div>}
            {hasEtsy && <div className={`agent-nav-cluster ${view === "etsyChat" || view === "etsyDashboard" ? "current" : ""}`}>
              <button className={`nav-parent ${view === "etsyChat" || view === "etsyDashboard" ? "active" : ""}`} onClick={() => navigate(canViewEtsyDashboard ? "etsyDashboard" : "etsyChat")}><span className="agent-dot etsy"><Bot /></span><span><strong>Etsy AI</strong><small>Phòng Sell Etsy</small></span><ChevronRight /></button>
              <div className="subnav">
                {canViewEtsyDashboard && <NavButton compact active={view === "etsyDashboard"} icon={<Gauge />} label="Tổng quan" onClick={() => navigate("etsyDashboard")} />}
                {canRunEtsyChat && <NavButton compact active={view === "etsyChat"} icon={<MessageCircle />} label="Hỏi đáp" onClick={() => navigate("etsyChat")} />}
              </div>
            </div>}
            {hasAccounting && <div className={`agent-nav-cluster ${view === "accountingChat" || view === "accountingDashboard" ? "current" : ""}`}>
              <button className={`nav-parent ${view === "accountingChat" || view === "accountingDashboard" ? "active" : ""}`} onClick={() => navigate(canViewAccountingDashboard ? "accountingDashboard" : "accountingChat")}><span className="agent-dot finance"><Calculator /></span><span><strong>Kế toán AI</strong><small>Phòng Kế toán</small></span><ChevronRight /></button>
              <div className="subnav">
                {canViewAccountingDashboard && <NavButton compact active={view === "accountingDashboard"} icon={<Gauge />} label="Tổng quan" onClick={() => navigate("accountingDashboard")} />}
                {canRunAccountingChat && <NavButton compact active={view === "accountingChat"} icon={<MessageCircle />} label="Hỏi đáp" onClick={() => navigate("accountingChat")} />}
              </div>
            </div>}
          </NavGroup>}
          {(isAdmin || canViewAudit) && <NavGroup label={isAdmin ? "Quản trị" : "Theo dõi"}>
            {isAdmin && <NavButton active={view === "users"} icon={<Users />} label="Người dùng & quyền" onClick={() => navigate("users")} />}
            {isAdmin && <NavButton active={view === "knowledge"} icon={<BookOpen />} label="Kho tri thức CEO AI" onClick={() => navigate("knowledge")} />}
            {isAdmin && <NavButton active={view === "tiktokKnowledge"} icon={<BookOpen />} label="Kho tri thức TikTok AI" onClick={() => navigate("tiktokKnowledge")} />}
            {isAdmin && <NavButton active={view === "etsyKnowledge"} icon={<BookOpen />} label="Kho tri thức Etsy AI" onClick={() => navigate("etsyKnowledge")} />}
            {isAdmin && <NavButton active={view === "accountingKnowledge"} icon={<BookOpen />} label="Kho tri thức Kế toán AI" onClick={() => navigate("accountingKnowledge")} />}
            {isAdmin && <NavButton active={view === "questions"} icon={<CircleHelp />} label="Câu hỏi cần bổ sung" onClick={() => navigate("questions")} />}
            {isAdmin && <NavButton active={view === "sources"} icon={<Database />} label="Nguồn dữ liệu" onClick={() => navigate("sources")} />}
            {canViewAudit && <NavButton active={view === "audit"} icon={<ShieldCheck />} label={isAdmin ? "Nhật ký AI" : "Lịch sử hoạt động"} onClick={() => navigate("audit")} />}
            {isAdmin && <NavButton icon={<Settings2 />} label="Cấu hình" disabled />}
          </NavGroup>}
        </nav>
        {isAdmin && <div className="sidebar-health"><span className="status-light" /><div><strong>Platform operational</strong><small>{definition?.provider.model || "Chưa có model"}</small></div></div>}
      </div>
    </aside>
    {sidebarOpen && <button className="screen-backdrop" onClick={() => setSidebarOpen(false)} />}

    <main className="workspace">
      <header className="global-header">
        <button className="header-menu" onClick={() => setSidebarOpen(true)}><Menu /></button>
        <div className="search-box"><Search /><span>Tìm trong không gian làm việc</span></div>
        <div className="header-tools"><NotificationBell onNavigate={(route) => routerNavigate(route)} /><div className="profile-wrap"><button className="profile-button" onClick={() => setProfileOpen((value) => !value)}><span className="profile">{initials(session.user.displayName)}</span><span className="profile-copy"><strong>{session.user.displayName}</strong><small>{roleLabel(session.user.role)}</small></span><ChevronDown /></button>{profileOpen && <div className="profile-menu"><div><strong>{session.user.displayName}</strong><span>{session.user.email}</span></div><button onClick={() => { setPasswordOpen(true); setProfileOpen(false); }}><KeyRound /> Đổi mật khẩu</button><button className="logout-action" onClick={() => void onLogout()}><LogOut /> Đăng xuất</button></div>}</div></div>
      </header>
      <div className={`workspace-body ${view === "chat" || view === "ceoChat" || view === "tiktokChat" || view === "etsyChat" || view === "accountingChat" ? "chat-page-body" : ""} ${view === "multiAgent" ? "multi-agent-page-body" : ""} ${view === "office" ? "office-page-body" : ""}`}>
        {view !== "chat" && view !== "ceoChat" && view !== "tiktokChat" && view !== "etsyChat" && view !== "accountingChat" && view !== "multiAgent" && view !== "office" && view !== "tasks" && view !== "dailyReports" && <div className="page-heading"><div><span>{title[0]}</span><h1>{title[1]}</h1></div><div className="heading-actions">{isAdmin && <div className="api-state"><i className={systemOnline ? "ok" : "down"} /> API {systemOnline ? "ổn định" : "mất kết nối"}</div>}<button className="refresh-button" onClick={() => void load()}><RefreshCw /></button></div></div>}
        {error && <div className="error-banner"><AlertTriangle /><span>{error}</span><button onClick={() => setError(null)}><X /></button></div>}
        {view === "common" && <CommonDashboard definition={definition} runs={runs} systemOnline={systemOnline} sourceOnline={sourceOnline} isAdmin={isAdmin} hasLemiex={hasLemiex} displayName={session.user.displayName} onOpenLemiex={() => navigate("lemiex")} />}
        {view === "tasks" && <TaskManagerView session={session} />}
        {view === "dailyReports" && <DailyReportsView session={session} />}
        {view === "multiAgent" && canCoordinateAgents && <MultiAgentMeetingView availableAgentIds={availableMultiAgentIds} />}
        {view === "office" && <Suspense fallback={<div className="office-module-loader"><Building2 /><span>Đang mở không gian 3D...</span></div>}><AiOfficeView
          displayName={session.user.displayName}
          scope={lemiexOnly ? "lemiex" : "all"}
          canRunLemiexChat={canRunChat}
          canRunCeoChat={canRunCeoChat}
          canRunTiktokChat={canRunTiktokChat}
          canRunEtsyChat={canRunEtsyChat}
          canCoordinateAgents={canCoordinateAgents && availableMultiAgentIds.length > 1}
          onOpenLemiexChat={() => navigate("chat")}
          onOpenMultiAgent={() => navigate("multiAgent")}
        /></Suspense>}
        {view === "activity" && <ActivityView runs={runs} isAdmin={isAdmin} />}
        {view === "lemiex" && <LemiexOverview selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedRun={selectedRun} metrics={metrics} review={review} loading={loading} running={running} canRun={canRunDaily} isAdmin={isAdmin} onRun={runAnalysis} />}
        {view === "chat" && canRunChat && <LemiexChatView isAdmin={isAdmin} />}
        {view === "ceoChat" && canRunCeoChat && <CeoChatView isAdmin={isAdmin} />}
        {view === "tiktokDashboard" && canViewTiktokDashboard && <TiktokDashboardView />}
        {view === "tiktokChat" && canRunTiktokChat && <CeoChatView isAdmin={isAdmin} variant="tiktok" />}
        {view === "etsyDashboard" && canViewEtsyDashboard && <EtsyDashboardView />}
        {view === "etsyChat" && canRunEtsyChat && <CeoChatView isAdmin={isAdmin} variant="etsy" />}
        {view === "accountingDashboard" && canViewAccountingDashboard && <AccountingDashboardView />}
        {view === "accountingChat" && canRunAccountingChat && <CeoChatView isAdmin={isAdmin} variant="accounting" />}
        {view === "reports" && <ReportsView selectedDate={selectedDate} setSelectedDate={setSelectedDate} report={report} runs={runs} isAdmin={isAdmin} onOpen={(date) => { setSelectedDate(date); navigate("lemiex"); }} />}
        {view === "backlog" && <BacklogView metrics={metrics} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
        {view === "users" && isAdmin && <AdminUsersView />}
        {view === "knowledge" && isAdmin && <KnowledgeHubView />}
        {view === "tiktokKnowledge" && isAdmin && <KnowledgeHubView agentId="tiktok-ai" />}
        {view === "etsyKnowledge" && isAdmin && <KnowledgeHubView agentId="etsy-ai" />}
        {view === "accountingKnowledge" && isAdmin && <KnowledgeHubView agentId="accounting-ai" />}
        {view === "questions" && isAdmin && <AdminQuestionsView />}
        {view === "audit" && <AuditView runs={runs} isAdmin={isAdmin} />}
        {view === "sources" && <SourcesView sourceOnline={sourceOnline} metrics={metrics} definition={definition} />}
      </div>
    </main>
    {passwordOpen && <ChangePasswordDialog required={session.user.passwordResetRequired} onClose={() => setPasswordOpen(false)} onChanged={onSessionEnded} />}
  </div>;
}

function SessionLoader() {
  return <main className="session-loader"><div className="login-mark"><BrainCircuit /></div><span>Đang xác minh phiên đăng nhập...</span></main>;
}

function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError(null);
    try {
      await onLogin(email, password);
    } catch (cause) {
      setLoginError(cause instanceof Error ? cause.message : "Không thể đăng nhập");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="login-page">
    <section className="login-story">
      <div className="login-brand"><div className="login-mark"><BrainCircuit /></div><div><strong>Feline AI</strong><span>Không gian làm việc AI</span></div></div>
      <div className="login-message"><h1>Mỗi người nhìn thấy<br />đúng phần việc của mình.</h1><p>Mỗi tài khoản chỉ nhìn thấy đúng trợ lý, chức năng và dữ liệu đã được cấp.</p></div>
      <div className="access-strata"><div><ShieldCheck /><span><strong>Admin</strong><small>Toàn quyền nền tảng</small></span></div><div><Users /><span><strong>Manager</strong><small>Theo trợ lý được giao</small></span></div><div><UserRound /><span><strong>User</strong><small>Theo trợ lý và dữ liệu được cấp</small></span></div></div>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="login-card-heading"><h2>Chào mừng trở lại</h2><p>Đăng nhập bằng tài khoản được quản trị viên cấp.</p></div>
        {loginError && <div className="login-error" role="alert"><AlertTriangle />{loginError}</div>}
        <label className="field-label" htmlFor="login-email">Email</label>
        <div className="login-field"><UserRound /><input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" placeholder="ten@congty.com" required autoFocus /></div>
        <label className="field-label" htmlFor="login-password">Mật khẩu</label>
        <div className="login-field"><LockKeyhole /><input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Nhập mật khẩu" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff /> : <Eye />}</button></div>
        <button type="submit" className="login-submit" disabled={submitting}>{submitting ? <RefreshCw className="spin" /> : <KeyRound />}{submitting ? "Đang xác minh..." : "Đăng nhập"}</button>
        <div className="login-security"><ShieldCheck /><span><strong>Phiên đăng nhập được bảo vệ</strong><small>Quyền truy cập được kiểm tra trong suốt phiên làm việc.</small></span></div>
      </form>
    </section>
  </main>;
}

function ChangePasswordDialog({ required, onClose, onChanged }: { required?: boolean; onClose: () => void; onChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đổi mật khẩu");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="dialog-backdrop" role="presentation"><form className="password-dialog" onSubmit={submit}><div className="dialog-heading"><div><span>BẢO MẬT TÀI KHOẢN</span><h2>{required ? "Tạo mật khẩu mới" : "Đổi mật khẩu"}</h2></div>{!required && <button type="button" onClick={onClose}><X /></button>}</div>{required && <p className="password-hint">Tài khoản cần đổi mật khẩu tạm trước khi sử dụng hệ thống.</p>}{error && <div className="login-error"><AlertTriangle />{error}</div>}<label className="field-label">Mật khẩu hiện tại</label><div className="login-field"><LockKeyhole /><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></div><label className="field-label">Mật khẩu mới</label><div className="login-field"><KeyRound /><input type="password" minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></div><p className="password-hint">Tối thiểu 8 ký tự.</p><label className="field-label">Xác nhận mật khẩu mới</label><div className="login-field"><ShieldCheck /><input type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div><div className="dialog-actions">{!required && <button type="button" onClick={onClose}>Hủy</button>}<button className="login-submit" disabled={submitting}>{submitting ? <RefreshCw className="spin" /> : <KeyRound />}{submitting ? "Đang cập nhật..." : "Đổi mật khẩu"}</button></div></form></div>;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "AI";
}

function roleLabel(role: AuthSession["user"]["role"]) {
  return { ADMIN: "Quản trị viên", MANAGER: "Quản lý Agent", USER: "Người dùng" }[role];
}

function CommonDashboard({ definition, runs, systemOnline, sourceOnline, isAdmin, hasLemiex, displayName, onOpenLemiex }: { definition: AgentDefinition | null; runs: AgentRun[]; systemOnline: boolean; sourceOnline: boolean; isAdmin: boolean; hasLemiex: boolean; displayName: string; onOpenLemiex: () => void }) {
  const completed = runs.filter((run) => run.status === "COMPLETED").length;
  const failed = runs.filter((run) => run.status === "FAILED").length;
  const available = definition?.capabilities.filter((item) => item.status === "available").length || 0;
  const planned = definition?.capabilities.filter((item) => item.status === "planned").length || 0;
  return <>
    <section className="platform-welcome"><div><span className="blue-kicker"><Sparkles /> {isAdmin ? "Feline AI" : `Xin chào, ${displayName}`}</span><h2>{isAdmin ? <>Toàn cảnh hoạt động<br />trong một nhịp nhìn.</> : <>Công việc hôm nay,<br /><em>rõ ràng trong một nhịp nhìn.</em></>}</h2><p>{isAdmin ? "Theo dõi các AI, dữ liệu và hoạt động gần đây trên toàn nền tảng." : "Xem tình hình xưởng, đọc báo cáo và trao đổi trực tiếp với các trợ lý bạn được cấp quyền."}</p>{hasLemiex && <button onClick={onOpenLemiex}>Mở Lemiex AI <ChevronRight /></button>}</div><div className="network-visual"><div className="core-node"><BrainCircuit /></div><span className="node n1"><Bot /></span><span className="node n2"><Users /></span><span className="node n3"><BarChart3 /></span></div></section>
    {isAdmin ? <section className="summary-grid">
      <SummaryCard icon={<Bot />} tone="blue" label="AI đang hoạt động" value="1" detail="2 agent đang lên kế hoạch" />
      <SummaryCard icon={<CircleDot />} tone="cyan" label="Năng lực khả dụng" value={String(available)} detail={`${planned} capability đã định tuyến`} />
      <SummaryCard icon={<FileText />} tone="orange" label="Lượt phân tích hoàn tất" value={String(completed)} detail={failed ? `${failed} lượt cần kiểm tra` : "Không có lỗi đang mở"} />
      <SummaryCard icon={<Database />} tone="green" label="Phạm vi dữ liệu" value={hasLemiex ? "Đã cấp" : "—"} detail={isAdmin ? (sourceOnline ? "shop-test · read-only" : "Nguồn đang gián đoạn") : "Theo quyền Agent hiện tại"} />
    </section> : <section className="summary-grid user-summary-grid">
      <SummaryCard icon={<Bot />} tone="blue" label="Trợ lý công việc" value="Lemiex AI" detail="Vận hành xưởng" />
      <SummaryCard icon={<FileText />} tone="orange" label="Phân tích hoàn tất" value={String(completed)} detail="Các lượt gần đây" />
    </section>}
    <section className={`dashboard-columns ${isAdmin ? "" : "single-column"}`}>
      <article className="white-card agents-panel"><CardTitle eyebrow="Agent directory" title="Các AI trong hệ thống" action="Quản lý theo domain" />
        {hasLemiex && <AgentRow name="Lemiex AI" domain="Vận hành xưởng" color="#3f7df4" status="Đang hoạt động" capabilities={`${available} khả dụng · ${planned} kế hoạch`} onClick={onOpenLemiex} />}
        {isAdmin && <AgentRow name="Sales AI" domain="Bán hàng và khách hàng" color="#22c7c9" status="Sắp triển khai" capabilities="Chưa kết nối dữ liệu" />}
        {isAdmin && <AgentRow name="Finance AI" domain="Tài chính và chi phí" color="#ffad42" status="Sắp triển khai" capabilities="Chưa kết nối dữ liệu" />}
      </article>
      {isAdmin && <article className="white-card health-panel"><CardTitle eyebrow="System health" title="Tình trạng nền tảng" />
        <HealthRow label="API & Orchestrator" detail="Điều phối agent" ok={systemOnline} />
        <HealthRow label="Database" detail="PostgreSQL audit store" ok={systemOnline} />
        <HealthRow label="Queue & Worker" detail="Xử lý nền" ok={systemOnline} />
        {isAdmin && <HealthRow label="shop-test" detail="Nguồn chỉ đọc" ok={sourceOnline} />}
      </article>}
    </section>
    <section className="white-card recent-panel"><CardTitle eyebrow="Cross-agent activity" title="Hoạt động gần đây" action={`${runs.length} sự kiện`} /><RunTable runs={runs.slice(0, 6)} /></section>
  </>;
}

function LemiexOverview({ selectedDate, setSelectedDate, selectedRun, metrics, review, loading, running, canRun, isAdmin, onRun }: { selectedDate: string; setSelectedDate: (value: string) => void; selectedRun?: AgentRun; metrics?: DailyMetrics; review: AgentRun["output"] | undefined; loading: boolean; running: boolean; canRun: boolean; isAdmin: boolean; onRun: () => void }) {
  const oldBacklog = metrics?.backlog.byAgeBand.find((item) => item.ageBand === ">=72h")?.orders || 0;
  const financials = metrics?.management?.financials;
  const trend = metrics?.management?.dailyTrend || [];
  const sellers = metrics?.management?.sellerRanking || [];
  const orderTypes = metrics?.intake.orderTypes || [];
  return <>
    <section className="workshop-command">
      <div className="workshop-command-copy"><span className="workshop-command-icon"><Bot /></span><div><strong>Lemiex AI</strong><span>Đơn hàng, tài chính và rủi ro vận hành theo ngày</span></div></div>
      <div className="date-run"><label><CalendarDays /> Ngày dữ liệu</label><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />{canRun && <button onClick={onRun} disabled={running}>{running ? <RefreshCw className="spin" /> : <Play />} {running ? "Đang phân tích" : "Chạy phân tích"}</button>}</div>
    </section>
    <section className={`workshop-metric-layout ${financials ? "" : "without-financials"}`}>
      <div className="workshop-primary-metrics">
        <WorkshopMetric featured icon={<ClipboardList />} label="Đơn tiếp nhận" value={metrics?.intake.orders?.toLocaleString("vi-VN") || "—"} detail="Tổng đơn trong kỳ báo cáo" />
        {financials && <WorkshopMetric featured tone="finance" icon={<DollarSign />} label="Doanh thu đã chốt" value={formatUsd(financials.paidCost)} detail="Doanh thu ghi nhận từ đơn trong kỳ" />}
      </div>
      <div className="workshop-secondary-metrics">
        <WorkshopMetric tone="flow" icon={<PackageCheck />} label="Shipout" value={metrics?.shipout.completedOrders?.toLocaleString("vi-VN") || "—"} detail={metrics ? `${metrics.shipout.completedOrders - metrics.intake.orders >= 0 ? "+" : ""}${metrics.shipout.completedOrders - metrics.intake.orders} so với tiếp nhận` : "Chưa có dữ liệu"} />
        <WorkshopMetric tone="warning" icon={<Boxes />} label="Backlog" value={metrics?.backlog.totalOrders?.toLocaleString("vi-VN") || "—"} detail={`${oldBacklog} đơn từ 72 giờ`} />
        {financials && <WorkshopMetric icon={<DollarSign />} label="Phí fulfillment" value={formatUsd(financials.totalCost)} detail="Tổng phí trong kỳ" />}
        <WorkshopMetric tone={metrics?.remakes.cases ? "critical" : "quality"} icon={<ShieldCheck />} label="Remake" value={metrics?.remakes.cases?.toLocaleString("vi-VN") || "—"} detail={metrics?.remakes.cases === 0 ? "Không phát sinh" : "Cần kiểm tra"} />
      </div>
    </section>
    <section className="dashboard-columns ai-layout workshop-decision-row"><article className="white-card analysis-card"><CardTitle eyebrow="Grounded analysis" title="Nhận định Lemiex AI" action={<StatusPill status={selectedRun?.status} />} />
      {loading ? <Skeleton /> : review ? <div className="review-content"><p className="review-summary">{review.summary || "Chưa có nội dung nhận định cho lần chạy này."}</p><div className="review-columns"><Insight title="Dữ liệu cho thấy" icon={<CheckCircle2 />} items={review.dataShows} /><Insight title="Cần điều tra" icon={<AlertTriangle />} items={review.needsInvestigation} warning /></div>{isAdmin && <div className="review-meta"><span>{selectedRun?.model}</span><span>{selectedRun?.inputTokens?.toLocaleString("vi-VN")} input tokens</span><span>{formatTime(selectedRun?.completedAt)}</span></div>}</div> : canRun ? <EmptyAnalysis onRun={onRun} running={running} failure={selectedRun?.status === "FAILED" ? selectedRun.error : undefined} /> : <NoData />}
    </article><BacklogDonut metrics={metrics} /></section>
    {financials && <>
      <section className="workshop-chart-grid">
        <article className="white-card workshop-trend"><CardTitle eyebrow="7 ngày gần nhất" title="Nhịp đơn hàng và doanh thu" />
          {trend.length ? <ResponsiveContainer width="100%" height={320}><ComposedChart data={trend} margin={{ top: 12, right: 20, left: 4, bottom: 4 }}><CartesianGrid vertical={false} stroke="#e4ddd3" /><XAxis dataKey="reportDate" tickFormatter={shortDate} axisLine={false} tickLine={false} tick={{ fill: "#66584d", fontSize: 10 }} /><YAxis yAxisId="orders" axisLine={false} tickLine={false} tick={{ fill: "#66584d", fontSize: 10 }} /><YAxis yAxisId="money" orientation="right" axisLine={false} tickLine={false} tickFormatter={compactUsd} tick={{ fill: "#66584d", fontSize: 10 }} /><Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "rgba(127,32,40,.045)" }} formatter={(value, name) => name === "Doanh thu" ? formatUsd(Number(value)) : Number(value).toLocaleString("vi-VN")} labelFormatter={(value) => formatDate(String(value))} /><Legend iconType="circle" iconSize={7} wrapperStyle={{ color: "#66584d", fontSize: 10, paddingTop: 8 }} /><Bar yAxisId="orders" dataKey="orders" name="Đơn hàng" fill="#7f2028" radius={[6,6,0,0]} barSize={24} /><Line yAxisId="money" type="monotone" dataKey="revenue" name="Doanh thu" stroke="#3f624b" strokeWidth={3} dot={false} activeDot={{ r: 4, fill: "#3f624b", stroke: "#fffdfa", strokeWidth: 2 }} /></ComposedChart></ResponsiveContainer> : <NoData />}
        </article>
        <article className="white-card order-mix"><CardTitle eyebrow="Cơ cấu đơn" title="Theo loại sản phẩm" action={`${metrics?.intake.orders || 0} đơn`} />
          {orderTypes.length ? <><div className="mix-chart"><ResponsiveContainer width="100%" height={245}><PieChart><Pie data={orderTypes} dataKey="orders" nameKey="orderType" innerRadius={64} outerRadius={90} paddingAngle={2} stroke="#fffdfa" strokeWidth={2}>{orderTypes.map((item) => <Cell key={item.orderType} fill={categoryColor(item.orderType || "Khác")} />)}</Pie><Tooltip contentStyle={CHART_TOOLTIP_STYLE} /></PieChart></ResponsiveContainer><div><strong>{metrics?.intake.quantity || 0}</strong><span>sản phẩm</span></div></div><div className="mix-legend">{orderTypes.slice(0, 8).map((item) => <span key={item.orderType}><i style={{ background: categoryColor(item.orderType || "Khác") }} /><em>{item.orderType || "Khác"}</em><b>{item.orders}</b></span>)}</div></> : <NoData />}
        </article>
      </section>
      <section className="white-card seller-ranking"><CardTitle eyebrow="Hiệu quả theo seller" title="Bảng xếp hạng seller" action="Top 10 theo doanh thu" />
        <div className="table-wrap"><table><thead><tr><th>Hạng</th><th>Seller</th><th>Đơn hàng</th><th>Items</th><th>Số lượng</th><th>Doanh thu đã chốt</th><th>Phí đã tính</th></tr></thead><tbody>{sellers.map((seller, index) => <tr key={seller.sellerId}><td><span className={`rank rank-${index + 1}`}><Trophy />{index + 1}</span></td><td><strong>{seller.seller}</strong><small>{seller.stores}</small></td><td>{seller.orders.toLocaleString("vi-VN")}</td><td>{seller.items.toLocaleString("vi-VN")}</td><td>{seller.quantity.toLocaleString("vi-VN")}</td><td><strong className="money-positive">{formatUsd(seller.revenue)}</strong></td><td>{formatUsd(seller.fees)}</td></tr>)}</tbody></table>{!sellers.length && <NoData />}</div>
      </section>
    </>}
  </>;
}

function ReportsView({ selectedDate, setSelectedDate, report, runs, isAdmin, onOpen }: { selectedDate: string; setSelectedDate: (value: string) => void; report?: string; runs: AgentRun[]; isAdmin: boolean; onOpen: (date: string) => void }) {
  const dates = [...new Set(runs.map((run) => run.input.reportDate).filter(Boolean))] as string[];
  return <section className="reports-layout"><article className="white-card report-list"><CardTitle eyebrow="Report archive" title="Danh sách báo cáo" />{dates.map((date) => <button key={date} className={date === selectedDate ? "selected" : ""} onClick={() => setSelectedDate(date)}><span className="file-icon"><FileText /></span><span><strong>Báo cáo xưởng Lemiex</strong><small>{formatDate(date)}</small></span><StatusPill status="COMPLETED" /></button>)}</article><article className="white-card report-preview"><CardTitle eyebrow="Deterministic report" title={`Báo cáo ${formatDate(selectedDate)}`} action={<button className="link-button" onClick={() => onOpen(selectedDate)}>Mở tổng quan</button>} /><ReportDocument content={report} isAdmin={isAdmin} /></article></section>;
}

function ReportDocument({ content, isAdmin }: { content?: string; isAdmin: boolean }) {
  if (!content) return <div className="report-empty"><FileText /><strong>Chưa có báo cáo cho ngày đã chọn</strong><span>Chọn ngày khác hoặc chạy phân tích để tạo báo cáo.</span></div>;
  const nodes: ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    nodes.push(<ul className="report-bullets" key={`list-${nodes.length}`}>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>);
  };
  content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const displayLine = line.replace(/BACKLOG TẠI THỜI ĐIỂM SNAPSHOT/gi, "BACKLOG TẠI THỜI ĐIỂM GHI NHẬN");
    if (!isAdmin && /^Nguồn\s*:/i.test(displayLine)) return;
    if (/^[•*-]\s+/.test(displayLine)) {
      bullets.push(displayLine.replace(/^[•*-]\s+/, ""));
      return;
    }
    flushBullets();
    if (/^\d+[.)]\s*/.test(displayLine)) {
      nodes.push(<h4 key={`section-${nodes.length}`}>{displayLine.replace(/^\d+[.)]\s*/, "")}</h4>);
    } else if (/^(⚠|CHẤT LƯỢNG|CẢNH BÁO)/i.test(displayLine)) {
      nodes.push(<div className="report-warning" key={`warning-${nodes.length}`}><AlertTriangle />{displayLine.replace(/^⚠\s*/, "")}</div>);
    } else if (/^(Kỳ dữ liệu|Nguồn|Cập nhật|Thời gian)/i.test(displayLine)) {
      const [label, ...rest] = displayLine.split(":");
      nodes.push(<p className="report-meta-line" key={`meta-${nodes.length}`}><strong>{label}</strong><span>{rest.join(":").trim()}</span></p>);
    } else if (nodes.length === 0) {
      nodes.push(<h3 key="report-title">{displayLine.replace(/^[^\p{L}\p{N}]+/u, "")}</h3>);
    } else {
      nodes.push(<p key={`text-${nodes.length}`}>{displayLine}</p>);
    }
  });
  flushBullets();
  return <div className="report-document">{nodes}</div>;
}

function BacklogView({ metrics, selectedDate, setSelectedDate }: { metrics?: DailyMetrics; selectedDate: string; setSelectedDate: (value: string) => void }) {
  const data = metrics?.backlog.byStatus.map((item) => ({ name: item.status.replaceAll("_", " "), orders: item.orders, overdue: item.atLeast72Hours })) || [];
  return <><div className="filter-line"><label><CalendarDays /> Dữ liệu ngày</label><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></div><section className="dashboard-columns backlog-layout"><article className="white-card chart-card"><CardTitle eyebrow="Backlog by status" title="Đơn tồn theo trạng thái" />{data.length ? <ResponsiveContainer width="100%" height={370}><BarChart data={data} margin={{ top: 20, right: 20, left: -15, bottom: 15 }}><CartesianGrid vertical={false} stroke="#e7dbcc" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} /><Tooltip /><Bar dataKey="orders" name="Tổng đơn" fill="#8f252c" radius={[8,8,0,0]} /><Bar dataKey="overdue" name="Từ 72 giờ" fill="#c9943b" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer> : <NoData />}</article><article className="white-card backlog-table"><CardTitle eyebrow="Ageing details" title="Chi tiết cần chú ý" />{metrics?.backlog.byStatus.map((item) => <div className="backlog-row" key={item.status}><span><strong>{item.status.replaceAll("_", " ")}</strong><small>Tuổi TB {item.averageAgeHours} giờ</small></span><b>{item.orders}</b><em>{item.atLeast72Hours} quá 72h</em></div>) || <NoData />}</article></section></>;
}

function ActivityView({ runs, isAdmin }: { runs: AgentRun[]; isAdmin: boolean }) { return <section className="white-card"><CardTitle eyebrow="All agents" title="Luồng hoạt động AI" action={`${runs.length} bản ghi`} /><RunTable runs={runs} showTechnical={isAdmin} /></section>; }
function AuditView({ runs, isAdmin }: { runs: AgentRun[]; isAdmin: boolean }) { return <section className="white-card"><CardTitle eyebrow="Governance & audit" title={isAdmin ? "Nhật ký thực thi" : "Lịch sử hoạt động"} action="Chỉ xem" /><RunTable runs={runs} audit showTechnical={isAdmin} /></section>; }
function SourcesView({ sourceOnline, metrics, definition }: { sourceOnline: boolean; metrics?: DailyMetrics; definition: AgentDefinition | null }) { return <section className="source-grid"><SourceCard icon={<Database />} name="shop-test" type="MySQL · Read-only" ok={sourceOnline} detail="Nguồn dữ liệu đầu tiên của Lemiex" /><SourceCard icon={<ClipboardList />} name="PostgreSQL" type="Operational store" ok detail="Snapshot, báo cáo và audit" /><SourceCard icon={<Activity />} name="Redis / BullMQ" type="Queue infrastructure" ok detail="Điều phối job nền" /><SourceCard icon={<BrainCircuit />} name="Anthropic" type={definition?.provider.model || "AI provider"} ok={Boolean(definition?.provider.enabled)} detail={`${metrics?.meta.specVersion ? `Metric spec ${metrics.meta.specVersion}` : "Structured provider"}`} /></section>; }

function NavGroup({ label, children }: { label: string; children: ReactNode }) { return <div className="nav-group"><span>{label}</span>{children}</div>; }
function NavButton({ icon, label, active, badge, onClick, compact, disabled }: { icon?: ReactNode; label: string; active?: boolean; badge?: string; onClick?: () => void; compact?: boolean; disabled?: boolean }) { return <button disabled={disabled} className={`tree-button ${active ? "active" : ""} ${compact ? "compact" : ""}`} onClick={onClick}>{icon}{compact && !icon && <i />}{label}{badge && <b>{badge}</b>}</button>; }
function CardTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) { return <div className="card-title"><div><span>{eyebrow}</span><h3>{title}</h3></div>{action && <div className="card-action">{action}</div>}</div>; }
function SummaryCard({ icon, tone, label, value, detail }: { icon: ReactNode; tone: string; label: string; value: string; detail: string }) { return <article className="summary-card"><div className={`summary-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>; }
function WorkshopMetric({ icon, label, value, detail, featured, tone = "neutral" }: { icon: ReactNode; label: string; value: string; detail: string; featured?: boolean; tone?: string }) { return <article className={`workshop-metric ${featured ? "featured" : ""} ${tone}`}><span className="workshop-metric-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>; }
function AgentRow({ name, domain, color, status, capabilities, onClick }: { name: string; domain: string; color: string; status: string; capabilities: string; onClick?: () => void }) { return <button className="agent-row" onClick={onClick} disabled={!onClick}><span className="agent-avatar" style={{ background: color }}><Bot /></span><span><strong>{name}</strong><small>{domain}</small></span><span className={onClick ? "agent-status active" : "agent-status"}>{status}</span><em>{capabilities}</em><ChevronRight /></button>; }
function HealthRow({ label, detail, ok }: { label: string; detail: string; ok: boolean }) { return <div className="health-row"><span className={`health-symbol ${ok ? "ok" : "down"}`}><CheckCircle2 /></span><span><strong>{label}</strong><small>{detail}</small></span><em>{ok ? "Operational" : "Unavailable"}</em></div>; }
function StatusPill({ status }: { status?: AgentRun["status"] }) { const labels = { COMPLETED: "Hoàn tất", RUNNING: "Đang chạy", FAILED: "Thất bại", BLOCKED: "Đã chặn" }; return <span className={`status-pill ${status?.toLowerCase() || "neutral"}`}>{status ? labels[status] : "Chưa chạy"}</span>; }
function capabilityLabel(value?: string) {
  const id = value?.replace("lemiex.operations.", "");
  return { "daily-review": "Phân tích vận hành", ask: "Hỏi đáp vận hành" }[id || ""] || "Hoạt động AI";
}
function RunTable({ runs = [], audit, showTechnical = false }: { runs?: AgentRun[]; audit?: boolean; showTechnical?: boolean }) { return <div className="table-wrap"><table><thead><tr><th>Trợ lý / Hoạt động</th><th>Ngày dữ liệu</th><th>Trạng thái</th>{showTechnical && <th>Model</th>}{audit && showTechnical && <th>Công cụ</th>}<th>Hoàn tất</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td><strong>Lemiex AI</strong><small>{showTechnical ? run.capabilityId?.replace("lemiex.operations.", "") || "—" : capabilityLabel(run.capabilityId)}</small></td><td>{formatDate(run.input?.reportDate)}</td><td><StatusPill status={run.status} /></td>{showTechnical && <td>{run.model || "—"}</td>}{audit && showTechnical && <td>{run.toolCalls?.length || 0}</td>}<td>{formatTime(run.completedAt)}</td></tr>)}</tbody></table>{!runs.length && <NoData />}</div>; }
function Insight({ title, icon, items = [], warning }: { title: string; icon: ReactNode; items?: string[]; warning?: boolean }) { return <div className={warning ? "insight warning" : "insight"}><h4>{icon}{title}</h4>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>Không có điểm mới.</p>}</div>; }
function BacklogDonut({ metrics }: { metrics?: DailyMetrics }) { const data = metrics?.backlog.byAgeBand.map((item) => ({ name: item.ageBand.replace(">=", "≥"), value: item.orders })) || []; const old = metrics?.backlog.byAgeBand.find((item) => item.ageBand === ">=72h")?.orders || 0; return <article className="white-card donut-card"><CardTitle eyebrow="Backlog ageing" title="Phân bổ tuổi đơn" action={metrics?.backlog.totalOrders?.toString() || "—"} />{data.length ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data} dataKey="value" innerRadius={70} outerRadius={96} paddingAngle={2} stroke="#fffdfa" strokeWidth={2}>{data.map((item) => <Cell key={item.name} fill={ageBandColor(item.name)} />)}</Pie><Tooltip contentStyle={CHART_TOOLTIP_STYLE} /></PieChart></ResponsiveContainer><div><strong>{old}</strong><span>≥72 giờ</span></div></div><div className="legend">{data.map((item) => <span key={item.name}><i style={{ background: ageBandColor(item.name) }} />{item.name}<b>{item.value}</b></span>)}</div></> : <NoData />}</article>; }
function SourceCard({ icon, name, type, ok, detail }: { icon: ReactNode; name: string; type: string; ok: boolean; detail: string }) { return <article className="white-card source-card"><div className="source-icon">{icon}</div><span className={`source-state ${ok ? "ok" : "down"}`}>{ok ? "Connected" : "Offline"}</span><h3>{name}</h3><strong>{type}</strong><p>{detail}</p><button>Chi tiết kết nối <ChevronRight /></button></article>; }
function Skeleton() { return <div className="skeleton">{[92,84,76,89,68].map((width) => <span key={width} style={{ width: `${width}%` }} />)}</div>; }
function EmptyAnalysis({ onRun, running, failure }: { onRun: () => void; running: boolean; failure?: string | null }) {
  return <div className={`empty-state analysis-state ${running ? "is-running" : ""}`} aria-live="polite">
    {running ? <RefreshCw className="spin" /> : failure ? <AlertTriangle /> : <BrainCircuit />}
    <h3>{running ? "Lemiex AI đang phân tích" : failure ? "Lần phân tích trước chưa hoàn tất" : "Chưa có nhận định"}</h3>
    <p>{running ? "Đang đối chiếu số liệu và tạo nhận định. Quá trình này thường mất khoảng 1–2 phút." : failure ? "Bạn có thể chạy lại để tạo nhận định mới từ số liệu hiện tại." : "Chọn ngày có báo cáo và chạy Lemiex AI."}</p>
    {failure && !running && <small className="analysis-failure">{failure}</small>}
    <button onClick={onRun} disabled={running}>{running ? <RefreshCw className="spin" /> : <Play />} {running ? "Đang phân tích..." : failure ? "Thử lại" : "Phân tích ngay"}</button>
  </div>;
}
function NoData() { return <div className="no-data"><Boxes /><span>Chưa có dữ liệu</span></div>; }
