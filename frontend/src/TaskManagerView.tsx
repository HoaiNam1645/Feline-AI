import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, Archive, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, CircleDot,
  CalendarRange, Clock3, Filter, GripVertical, ListChecks, MessageSquareText, Plus,
  Pencil, RefreshCw, RotateCcw, Save, Search, Send, Trash2, UserRound, Users, X
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "./api";
import type { AuthSession, OrganizationDepartment, WorkTask, WorkTaskDateField, WorkTaskPerson, WorkTaskPriority, WorkTaskStatus, WorkTaskSummary, WorkTaskView } from "./types";

type BoardColumn = { id: string; title: string; statuses: WorkTaskStatus[]; dropStatus: WorkTaskStatus; tone: string };

const COLUMNS: BoardColumn[] = [
  { id: "unassigned", title: "Chờ tiếp nhận", statuses: ["DRAFT"], dropStatus: "DRAFT", tone: "stone" },
  { id: "todo", title: "Cần làm", statuses: ["ASSIGNED", "ACCEPTED"], dropStatus: "ASSIGNED", tone: "blue" },
  { id: "doing", title: "Đang thực hiện", statuses: ["IN_PROGRESS", "BLOCKED", "REJECTED"], dropStatus: "IN_PROGRESS", tone: "amber" },
  { id: "review", title: "Chờ duyệt", statuses: ["IN_REVIEW"], dropStatus: "IN_REVIEW", tone: "violet" },
  { id: "done", title: "Hoàn thành", statuses: ["COMPLETED"], dropStatus: "COMPLETED", tone: "green" }
];

const STATUS: Record<WorkTaskStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Chờ tiếp nhận", tone: "neutral" }, ASSIGNED: { label: "Cần làm", tone: "blue" }, ACCEPTED: { label: "Đã nhận", tone: "blue" },
  IN_PROGRESS: { label: "Đang thực hiện", tone: "amber" }, BLOCKED: { label: "Đang vướng", tone: "red" }, IN_REVIEW: { label: "Chờ duyệt", tone: "violet" },
  COMPLETED: { label: "Hoàn thành", tone: "green" }, REJECTED: { label: "Cần làm lại", tone: "red" }, CANCELED: { label: "Đã hủy", tone: "neutral" }
};
const PRIORITY: Record<WorkTaskPriority, string> = { LOW: "Thấp", NORMAL: "Bình thường", HIGH: "Cao", URGENT: "Khẩn cấp" };
const VIEWS: Array<{ id: WorkTaskView; label: string }> = [
  { id: "ACTIVE", label: "Đang hoạt động" },
  { id: "TODAY", label: "Hôm nay" },
  { id: "OVERDUE", label: "Quá hạn" },
  { id: "OVER_ESTIMATE", label: "Vượt ước tính" },
  { id: "COMPLETED", label: "Đã hoàn thành" },
  { id: "ARCHIVED", label: "Lưu trữ" },
  { id: "ALL", label: "Tất cả" }
];
type TaskDatePreset = "ALL" | "TODAY" | "YESTERDAY" | "THIS_WEEK" | "LAST_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";
type EstimateFilter = "ALL" | "OVER" | "NEAR" | "NO_ESTIMATE";
const DATE_PRESETS: Array<{ id: TaskDatePreset; label: string }> = [
  { id: "ALL", label: "Mọi thời gian" }, { id: "TODAY", label: "Hôm nay" }, { id: "YESTERDAY", label: "Hôm qua" },
  { id: "THIS_WEEK", label: "Tuần này" }, { id: "LAST_WEEK", label: "Tuần trước" },
  { id: "THIS_MONTH", label: "Tháng này" }, { id: "LAST_MONTH", label: "Tháng trước" }, { id: "CUSTOM", label: "Khoảng tùy chọn" }
];
const DATE_FIELDS: Array<{ id: WorkTaskDateField; label: string }> = [
  { id: "createdAt", label: "Ngày tạo" }, { id: "dueAt", label: "Hạn hoàn thành" },
  { id: "startedAt", label: "Ngày bắt đầu" }, { id: "completedAt", label: "Ngày hoàn thành" }, { id: "updatedAt", label: "Lần cập nhật" }
];

function formatDate(value: string | null, includeYear = false) {
  if (!value) return "Chưa đặt";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", ...(includeYear ? { year: "numeric" } : {}) }).format(new Date(value));
}
function formatTime(value: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value)); }
function dateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function isOverdue(task: WorkTask) { return Boolean(task.dueAt && new Date(task.dueAt) < new Date() && !["COMPLETED", "CANCELED"].includes(task.status)); }
function initials(name?: string) { return (name || "?").split(/\s+/).slice(-2).map((word) => word[0]).join("").toUpperCase(); }
function activeSeconds(task: WorkTask, now = Date.now()) { return task.activeTimeSeconds + (task.activeTimerStartedAt ? Math.max(0, Math.floor((now - new Date(task.activeTimerStartedAt).getTime()) / 1000)) : 0); }
function formatDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const days = Math.floor(totalMinutes / 1440); const hours = Math.floor((totalMinutes % 1440) / 60); const minutes = totalMinutes % 60;
  if (days) return `${days} ngày ${hours} giờ`;
  if (hours) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}
function estimateLabel(minutes: number | null) { return minutes ? formatDuration(minutes * 60) : "Chưa ước tính"; }
function formatOverrun(seconds: number) { return seconds < 60 ? "dưới 1 phút" : formatDuration(seconds); }
function vietnamDate(value = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
function shiftVietnamDate(date: string, days: number) { return vietnamDate(new Date(new Date(`${date}T12:00:00+07:00`).getTime() + days * 86_400_000)); }
function datePresetRange(preset: TaskDatePreset, customFrom: string, customTo: string) {
  const today = vietnamDate();
  if (preset === "ALL") return { from: "", to: "" };
  if (preset === "TODAY") return { from: today, to: today };
  if (preset === "YESTERDAY") { const yesterday = shiftVietnamDate(today, -1); return { from: yesterday, to: yesterday }; }
  if (preset === "CUSTOM") return { from: customFrom, to: customTo };
  const day = new Date(`${today}T12:00:00+07:00`).getUTCDay();
  const monday = shiftVietnamDate(today, -(day === 0 ? 6 : day - 1));
  if (preset === "THIS_WEEK") return { from: monday, to: shiftVietnamDate(monday, 6) };
  if (preset === "LAST_WEEK") { const start = shiftVietnamDate(monday, -7); return { from: start, to: shiftVietnamDate(start, 6) }; }
  const [year, month] = today.split("-").map(Number);
  const monthRange = (targetYear: number, targetMonth: number) => ({
    from: `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`,
    to: `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()).padStart(2, "0")}`
  });
  if (preset === "THIS_MONTH") return monthRange(year, month);
  const previousMonth = month === 1 ? 12 : month - 1;
  return monthRange(month === 1 ? year - 1 : year, previousMonth);
}
function estimateRatio(task: WorkTask, now = Date.now()) { return task.estimatedMinutes ? activeSeconds(task, now) / (task.estimatedMinutes * 60) : null; }
function estimateStatus(task: WorkTask, now = Date.now()) {
  const ratio = estimateRatio(task, now);
  if (ratio === null) return "NONE";
  if (ratio > 1) return "OVER";
  if (ratio >= 0.8) return "NEAR";
  return "OK";
}

export function TaskManagerView({ session }: { session: AuthSession }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [summary, setSummary] = useState<WorkTaskSummary | null>(null);
  const initialView = VIEWS.some((item) => item.id === searchParams.get("taskView")) ? searchParams.get("taskView") as WorkTaskView : "ACTIVE";
  const initialPreset = DATE_PRESETS.some((item) => item.id === searchParams.get("period")) ? searchParams.get("period") as TaskDatePreset : "ALL";
  const initialDateField = DATE_FIELDS.some((item) => item.id === searchParams.get("dateField")) ? searchParams.get("dateField") as WorkTaskDateField : "createdAt";
  const [taskView, setTaskView] = useState<WorkTaskView>(initialView);
  const [departments, setDepartments] = useState<OrganizationDepartment[]>([]);
  const [departmentMembers, setDepartmentMembers] = useState<WorkTaskPerson[]>([]);
  const [departmentCode, setDepartmentCode] = useState(session.user.departmentCode || "TIKTOK");
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [selected, setSelected] = useState<WorkTask | null>(null);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [priorityFilter, setPriorityFilter] = useState<WorkTaskPriority | "ALL">((searchParams.get("priority") as WorkTaskPriority | "ALL") || "ALL");
  const [dueFilter, setDueFilter] = useState<"ALL" | "OVERDUE" | "NO_DUE">((searchParams.get("due") as "ALL" | "OVERDUE" | "NO_DUE") || "ALL");
  const [estimateFilter, setEstimateFilter] = useState<EstimateFilter>((searchParams.get("estimate") as EstimateFilter) || "ALL");
  const [assigneeFilter, setAssigneeFilter] = useState(searchParams.get("assignee") || "ALL");
  const [datePreset, setDatePreset] = useState<TaskDatePreset>(initialPreset);
  const [dateField, setDateField] = useState<WorkTaskDateField>(initialDateField);
  const [customFrom, setCustomFrom] = useState(searchParams.get("from") || "");
  const [customTo, setCustomTo] = useState(searchParams.get("to") || "");
  const [openFilter, setOpenFilter] = useState<"filters" | "members" | "dates" | null>(null);
  const [activeMobileColumn, setActiveMobileColumn] = useState("doing");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<string | null>(null);
  const [dropBeforeId, setDropBeforeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const isAdmin = session.user.role === "ADMIN";
  const canAssign = isAdmin || session.user.role === "MANAGER";
  const activeDateRange = datePresetRange(datePreset, customFrom, customTo);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [items, nextSummary] = await Promise.all([
        api.tasks({ department: departmentCode, view: taskView, dateField, from: activeDateRange.from || undefined, to: activeDateRange.to || undefined }),
        api.taskSummary(departmentCode)
      ]);
      setTasks(items);
      setSummary(nextSummary);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải công việc"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void api.taskDepartments().then((items) => { setDepartments(items); if (!items.some((item) => item.code === departmentCode) && items[0]) setDepartmentCode(items[0].code); }).catch(() => setDepartments([])); }, []);
  useEffect(() => { void load(); }, [departmentCode, taskView, dateField, activeDateRange.from, activeDateRange.to]);
  useEffect(() => { void api.taskAssignees(departmentCode).then(setDepartmentMembers).catch(() => setDepartmentMembers([])); }, [departmentCode]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || selected?.id === taskId) return;
    void api.task(taskId).then((task) => {
      setSelected(task);
      setDepartmentCode(task.departmentCode);
    }).catch(() => {
      const next = new URLSearchParams(searchParams);
      next.delete("task");
      setSearchParams(next, { replace: true });
    });
  }, [searchParams, selected?.id]);
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string, defaultValue = "") => value && value !== defaultValue ? next.set(key, value) : next.delete(key);
    setOrDelete("taskView", taskView, "ACTIVE"); setOrDelete("q", search); setOrDelete("priority", priorityFilter, "ALL");
    setOrDelete("due", dueFilter, "ALL"); setOrDelete("estimate", estimateFilter, "ALL"); setOrDelete("assignee", assigneeFilter, "ALL");
    setOrDelete("period", datePreset, "ALL"); setOrDelete("dateField", dateField, "createdAt");
    if (datePreset === "CUSTOM") { setOrDelete("from", customFrom); setOrDelete("to", customTo); } else { next.delete("from"); next.delete("to"); }
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [taskView, search, priorityFilter, dueFilter, estimateFilter, assigneeFilter, datePreset, dateField, customFrom, customTo]);

  const members = departmentMembers;
  const visible = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    return tasks.filter((task) => {
      if (keyword && !`${task.code} ${task.title} ${task.assignee?.displayName || ""}`.toLocaleLowerCase("vi-VN").includes(keyword)) return false;
      if (priorityFilter !== "ALL" && task.priority !== priorityFilter) return false;
      if (dueFilter === "OVERDUE" && !isOverdue(task)) return false;
      if (dueFilter === "NO_DUE" && task.dueAt) return false;
      const estimate = estimateStatus(task, clock);
      if (estimateFilter === "OVER" && estimate !== "OVER") return false;
      if (estimateFilter === "NEAR" && estimate !== "NEAR") return false;
      if (estimateFilter === "NO_ESTIMATE" && estimate !== "NONE") return false;
      if (assigneeFilter === "UNASSIGNED" && task.assignee) return false;
      if (!['ALL', 'UNASSIGNED'].includes(assigneeFilter) && task.assignee?.id !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, search, priorityFilter, dueFilter, estimateFilter, assigneeFilter, clock]);
  const filterCount = Number(priorityFilter !== "ALL") + Number(dueFilter !== "ALL") + Number(estimateFilter !== "ALL");
  const hasDateFilter = datePreset !== "ALL";
  const hasBoardFilter = Boolean(search.trim()) || filterCount > 0 || assigneeFilter !== "ALL" || hasDateFilter || !["ACTIVE", "ALL"].includes(taskView);
  const viewCount = (view: WorkTaskView) => {
    if (!summary) return null;
    if (view === "ACTIVE") return summary.active;
    if (view === "TODAY") return summary.today;
    if (view === "OVERDUE") return summary.overdue;
    if (view === "OVER_ESTIMATE") return summary.overEstimate;
    if (view === "COMPLETED") return summary.completed;
    if (view === "ARCHIVED") return summary.archived;
    if (view === "ALL") return summary.total;
    return null;
  };

  async function openTask(task: WorkTask) {
    const next = new URLSearchParams(searchParams);
    next.set("task", task.id);
    setSearchParams(next, { replace: true });
    setSelected(task);
    try { setSelected(await api.task(task.id)); } catch { /* Keep list data visible. */ }
  }
  function closeTask() {
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
    setSelected(null);
  }
  function canMove(task: WorkTask) { return isAdmin || session.user.role === "MANAGER" || task.assignee?.id === session.user.id; }

  async function moveTask(task: WorkTask, column: BoardColumn) {
    if (column.statuses.includes(task.status)) return;
    if (column.dropStatus !== "DRAFT" && !task.assignee) { setError("Hãy chỉ định người nhận trước khi chuyển công việc khỏi cột Chưa giao."); await openTask(task); return; }
    const previous = tasks;
    setMoving(task.id); setError(null);
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: column.dropStatus, progressPercent: column.dropStatus === "COMPLETED" ? 100 : item.progressPercent } : item));
    try {
      const updated = await api.updateTask(task.id, { status: column.dropStatus, message: `Chuyển sang ${column.title}` });
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
      if (selected?.id === task.id) setSelected(await api.task(task.id));
    } catch (cause) { setTasks(previous); setError(cause instanceof Error ? cause.message : "Không thể chuyển công việc"); }
    finally { setMoving(null); setDraggedId(null); setDropColumn(null); }
  }

  async function claimTask(task: WorkTask) {
    setMoving(task.id); setError(null);
    try {
      const updated = await api.claimTask(task.id);
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
      if (selected?.id === task.id) setSelected(await api.task(task.id));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể nhận công việc"); }
    finally { setMoving(null); }
  }

  async function reorderTask(task: WorkTask, target: WorkTask, column: BoardColumn) {
    if (task.id === target.id || task.status !== target.status || !column.statuses.includes(task.status)) return;
    if (hasBoardFilter) { setError("Hãy xóa bộ lọc trước khi sắp xếp thứ tự card trong cùng một cột."); return; }
    const columnTasks = tasks.filter((item) => item.status === task.status);
    const without = columnTasks.filter((item) => item.id !== task.id);
    const targetIndex = without.findIndex((item) => item.id === target.id);
    without.splice(targetIndex < 0 ? without.length : targetIndex, 0, task);
    const orderedIds = without.map((item) => item.id);
    const positions = new Map(orderedIds.map((id, position) => [id, position]));
    setTasks((current) => current.map((item) => positions.has(item.id) ? { ...item, position: positions.get(item.id)! } : item).sort((a, b) => a.position - b.position));
    try { await api.reorderTasks(task.status, orderedIds); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể sắp xếp công việc"); await load(); }
    finally { setDraggedId(null); setDropBeforeId(null); }
  }

  function drop(event: DragEvent, column: BoardColumn) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/task-id") || draggedId;
    const task = tasks.find((item) => item.id === id);
    if (task) void moveTask(task, column);
  }

  return <div className="tm-page">
    <header className="tm-heading"><div><h1>Công việc phòng ban</h1><p>Theo dõi tiến độ và phối hợp công việc giữa các phòng ban.</p></div><div className="tm-heading-actions"><div className="tm-department-wrap"><button className="tm-department" aria-expanded={departmentOpen} onClick={() => isAdmin && setDepartmentOpen((value) => !value)}><Users />{departments.find((item) => item.code === departmentCode)?.name || session.user.departmentCode || "Phòng ban"}{isAdmin && <ChevronRight />}</button>{departmentOpen && <div className="tm-department-menu">{departments.map((department) => <button key={department.id} className={department.code === departmentCode ? "active" : ""} onClick={() => { setDepartmentCode(department.code); setDepartmentOpen(false); setAssigneeFilter("ALL"); }}>{department.name}<small>{department.teams?.length || 0} team</small></button>)}</div>}</div>{canAssign && <button className="tm-primary" aria-label="Giao công việc" onClick={() => setCreateOpen(true)}><Plus /> Giao công việc</button>}</div></header>
    <nav className="tm-view-tabs" aria-label="Phạm vi công việc">{VIEWS.map((view) => <button key={view.id} className={taskView === view.id ? "active" : ""} onClick={() => { setTaskView(view.id); setSelected(null); setOpenFilter(null); }}><span>{view.label}</span>{viewCount(view.id) !== null && <b>{viewCount(view.id)}</b>}</button>)}</nav>
    <div className="tm-toolbar"><label className="tm-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã, tên công việc hoặc người nhận" /></label>
      <div className="tm-tool-wrap"><button className={`tm-tool-button ${hasDateFilter ? "active" : ""}`} aria-expanded={openFilter === "dates"} onClick={() => setOpenFilter((current) => current === "dates" ? null : "dates")}><CalendarRange /> {DATE_PRESETS.find((item) => item.id === datePreset)?.label}{hasDateFilter && <b>1</b>}</button>{openFilter === "dates" && <div className="tm-date-panel"><label><span>Lọc theo mốc</span><select value={dateField} onChange={(event) => setDateField(event.target.value as WorkTaskDateField)}>{DATE_FIELDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><div className="tm-date-presets">{DATE_PRESETS.map((item) => <button key={item.id} className={datePreset === item.id ? "selected" : ""} onClick={() => setDatePreset(item.id)}>{item.label}</button>)}</div>{datePreset === "CUSTOM" && <div className="tm-custom-dates"><label><span>Từ ngày</span><input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} /></label><label><span>Đến ngày</span><input type="date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} /></label></div>}<button className="tm-clear-filter" onClick={() => { setDatePreset("ALL"); setCustomFrom(""); setCustomTo(""); }}>Xóa lọc thời gian</button></div>}</div>
      <div className="tm-tool-wrap"><button className={`tm-tool-button ${filterCount ? "active" : ""}`} aria-expanded={openFilter === "filters"} onClick={() => setOpenFilter((current) => current === "filters" ? null : "filters")}><Filter /> Bộ lọc{filterCount > 0 && <b>{filterCount}</b>}</button>{openFilter === "filters" && <div className="tm-filter-panel"><label><span>Mức ưu tiên</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as WorkTaskPriority | "ALL")}><option value="ALL">Tất cả</option>{Object.entries(PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Deadline</span><select value={dueFilter} onChange={(event) => setDueFilter(event.target.value as typeof dueFilter)}><option value="ALL">Tất cả</option><option value="OVERDUE">Đã quá hạn</option><option value="NO_DUE">Chưa đặt hạn</option></select></label><label><span>Thời gian thực hiện</span><select value={estimateFilter} onChange={(event) => setEstimateFilter(event.target.value as EstimateFilter)}><option value="ALL">Tất cả</option><option value="OVER">Đã vượt ước tính</option><option value="NEAR">Đã dùng từ 80%</option><option value="NO_ESTIMATE">Chưa có ước tính</option></select></label><button onClick={() => { setPriorityFilter("ALL"); setDueFilter("ALL"); setEstimateFilter("ALL"); }}>Xóa bộ lọc</button></div>}</div>
      <div className="tm-tool-wrap"><button className={`tm-tool-button ${assigneeFilter !== "ALL" ? "active" : ""}`} aria-expanded={openFilter === "members"} onClick={() => setOpenFilter((current) => current === "members" ? null : "members")}><UserRound /> Thành viên{assigneeFilter !== "ALL" && <b>1</b>}</button>{openFilter === "members" && <div className="tm-member-panel"><button className={assigneeFilter === "ALL" ? "selected" : ""} onClick={() => { setAssigneeFilter("ALL"); setOpenFilter(null); }}>Tất cả thành viên</button><button className={assigneeFilter === "UNASSIGNED" ? "selected" : ""} onClick={() => { setAssigneeFilter("UNASSIGNED"); setOpenFilter(null); }}>Chưa giao</button>{members.map((member) => <button key={member.id} className={assigneeFilter === member.id ? "selected" : ""} onClick={() => { setAssigneeFilter(member.id); setOpenFilter(null); }}><i>{initials(member.displayName)}</i>{member.displayName}</button>)}</div>}</div>
      <button className="tm-tool-button tm-refresh" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "spin" : ""} /> Làm mới</button>
    </div>
    {(hasDateFilter || hasBoardFilter) && <div className="tm-active-filters"><span>Đang xem</span>{hasDateFilter && <button onClick={() => { setDatePreset("ALL"); setCustomFrom(""); setCustomTo(""); }}><CalendarRange />{DATE_FIELDS.find((item) => item.id === dateField)?.label}: {DATE_PRESETS.find((item) => item.id === datePreset)?.label}<X /></button>}{hasBoardFilter && <small>{hasBoardFilter ? "Sắp xếp card được khóa khi đang lọc để bảo toàn thứ tự toàn bộ board." : ""}</small>}</div>}
    {!['COMPLETED', 'ARCHIVED'].includes(taskView) && <nav className="tm-mobile-tabs" aria-label="Trạng thái công việc">{COLUMNS.map((column) => <button key={column.id} className={activeMobileColumn === column.id ? "active" : ""} onClick={() => setActiveMobileColumn(column.id)}><span>{column.title}</span><b>{visible.filter((task) => column.statuses.includes(task.status)).length}</b></button>)}</nav>}
    {error && <div className="tm-error"><AlertCircle /><span>{error}</span><button onClick={() => setError(null)}><X /></button></div>}
    {['COMPLETED', 'ARCHIVED'].includes(taskView) ? <TaskHistory tasks={visible} archived={taskView === "ARCHIVED"} loading={loading} canManage={isAdmin || session.user.role === "MANAGER"} onOpen={(task) => void openTask(task)} onArchive={async (task) => { await api.archiveTask(task.id); await load(); }} onRestore={async (task) => { await api.restoreTask(task.id); await load(); }} /> : <main className={`tm-board ${loading ? "loading" : ""}`} aria-busy={loading}>{COLUMNS.map((column) => {
      const rows = visible.filter((task) => column.statuses.includes(task.status));
      return <section key={column.id} className={`tm-column tone-${column.tone} ${activeMobileColumn === column.id ? "mobile-active" : ""} ${dropColumn === column.id ? "drop-target" : ""}`} onDragOver={(event) => { event.preventDefault(); setDropColumn(column.id); }} onDragLeave={() => setDropColumn(null)} onDrop={(event) => drop(event, column)}>
        <header><div><CircleDot /><h2>{column.title}</h2><span>{rows.length}</span></div></header>
        <div className="tm-card-list">{loading && <div className="tm-skeleton"><i /><i /><i /></div>}{!loading && rows.map((task) => <TaskCard key={task.id} task={task} session={session} now={clock} draggable={canMove(task)} dragging={draggedId === task.id} moving={moving === task.id} dropBefore={dropBeforeId === task.id} onClaim={() => void claimTask(task)} onOpen={() => void openTask(task)} onDragOver={(event) => { if (!draggedId) return; event.preventDefault(); event.stopPropagation(); setDropBeforeId(task.id); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const dragged = tasks.find((item) => item.id === draggedId); if (dragged && dragged.status === task.status) void reorderTask(dragged, task, column); else if (dragged) void moveTask(dragged, column); }} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/task-id", task.id); setDraggedId(task.id); }} onDragEnd={() => { setDraggedId(null); setDropColumn(null); setDropBeforeId(null); }} />)}{!loading && rows.length === 0 && <div className="tm-column-empty"><CheckCircle2 /><span>Chưa có công việc</span></div>}</div>
        {canAssign && column.id === "unassigned" && <button className="tm-add-card" onClick={() => setCreateOpen(true)}><Plus /> Thêm công việc</button>}
      </section>;
    })}</main>}
    {selected && createPortal(<TaskDetail task={selected} session={session} onClose={closeTask} onMove={(column) => moveTask(selected, column)} onChanged={async () => { await load(); setSelected(await api.task(selected.id)); }} />, document.body)}
    {createOpen && createPortal(<CreateTask departments={departments} initialDepartmentCode={departmentCode} session={session} onClose={() => setCreateOpen(false)} onCreated={async (task) => { setCreateOpen(false); setDepartmentCode(task.departmentCode); await load(); await openTask(task); }} />, document.body)}
  </div>;
}

function TaskHistory({ tasks, archived, loading, canManage, onOpen, onArchive, onRestore }: {
  tasks: WorkTask[];
  archived: boolean;
  loading: boolean;
  canManage: boolean;
  onOpen: (task: WorkTask) => void;
  onArchive: (task: WorkTask) => Promise<void>;
  onRestore: (task: WorkTask) => Promise<void>;
}) {
  const [workingId, setWorkingId] = useState<string | null>(null);
  async function act(task: WorkTask) {
    setWorkingId(task.id);
    try { await (archived ? onRestore(task) : onArchive(task)); }
    finally { setWorkingId(null); }
  }
  if (loading) return <div className="tm-history-loading"><i /><i /><i /></div>;
  if (!tasks.length) return <div className="tm-history-empty"><Archive /><h2>{archived ? "Chưa có công việc lưu trữ" : "Chưa có công việc hoàn thành"}</h2><p>{archived ? "Công việc đã hủy hoặc được lưu trữ sẽ xuất hiện tại đây." : "Công việc hoàn thành sẽ được tách khỏi board vận hành và lưu tại đây."}</p></div>;
  return <main className="tm-history" aria-label={archived ? "Công việc lưu trữ" : "Công việc đã hoàn thành"}>
    <header><span>Công việc</span><span>Người nhận</span><span>{archived ? "Lưu trữ lúc" : "Hoàn thành lúc"}</span><span>Thời gian làm</span><span /></header>
    {tasks.map((task) => <article key={task.id} tabIndex={0} onClick={() => onOpen(task)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(task); }}>
      <div><strong>{task.title}</strong><small>{task.code} · {task.team?.name || task.departmentName}</small></div>
      <div className="tm-history-person">{task.assignee ? <><i>{initials(task.assignee.displayName)}</i><span>{task.assignee.displayName}</span></> : <em>Chưa giao</em>}</div>
      <time>{formatDate(archived ? task.archivedAt : task.completedAt, true)}</time>
      <b>{formatDuration(activeSeconds(task))}</b>
      {canManage && <button disabled={workingId === task.id} onClick={(event) => { event.stopPropagation(); void act(task); }}>{archived ? <RotateCcw /> : <Archive />}{workingId === task.id ? "Đang xử lý" : archived ? "Khôi phục" : "Lưu trữ"}</button>}
    </article>)}
  </main>;
}

function TaskCard({ task, session, now, draggable, dragging, moving, dropBefore, onClaim, onOpen, onDragOver, onDrop, onDragStart, onDragEnd }: { task: WorkTask; session: AuthSession; now: number; draggable: boolean; dragging: boolean; moving: boolean; dropBefore: boolean; onClaim: () => void; onOpen: () => void; onDragOver: (event: DragEvent<HTMLElement>) => void; onDrop: (event: DragEvent<HTMLElement>) => void; onDragStart: (event: DragEvent<HTMLElement>) => void; onDragEnd: () => void }) {
  const checklistTotal = task.checklistItems?.length || 0;
  const checklistCompleted = task.checklistItems?.filter((item) => item.isCompleted).length || 0;
  const canClaim = !task.assignee && task.status === "DRAFT" && session.user.role !== "ADMIN";
  const workedSeconds = activeSeconds(task, now);
  const timeStatus = estimateStatus(task, now);
  const overrunSeconds = task.estimatedMinutes ? Math.max(0, workedSeconds - task.estimatedMinutes * 60) : 0;
  return <article className={`tm-card priority-${task.priority.toLowerCase()} estimate-${timeStatus.toLowerCase()} ${dragging ? "dragging" : ""} ${moving ? "moving" : ""} ${dropBefore ? "drop-before" : ""}`} draggable={draggable} onDragOver={onDragOver} onDrop={onDrop} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }}>
    <div className="tm-card-top"><span className="tm-tag">{task.team?.name ? `Team ${task.team.name}` : task.departmentName}</span>{draggable && <GripVertical />}</div><h3>{task.title}</h3><small>{task.code}</small>
    {(checklistTotal > 0 || task.progressPercent > 0) && <div className="tm-card-progress"><span><i style={{ width: `${task.progressPercent}%` }} /></span><b>{checklistTotal > 0 ? `${checklistCompleted}/${checklistTotal}` : `${task.progressPercent}%`}</b></div>}
    <div className="tm-card-time"><span className={isOverdue(task) ? "overdue" : ""}><CalendarDays />{formatDate(task.dueAt)}</span><span className={`${task.activeTimerStartedAt ? "running" : ""} ${timeStatus === "OVER" ? "over-estimate" : timeStatus === "NEAR" ? "near-estimate" : ""}`}><Clock3 />{timeStatus === "OVER" ? `Vượt ${formatOverrun(overrunSeconds)}` : task.activeTimerStartedAt || task.activeTimeSeconds ? `${formatDuration(workedSeconds)} / ${estimateLabel(task.estimatedMinutes)}` : estimateLabel(task.estimatedMinutes)}</span></div>
    <footer><span>Tạo {formatDate(task.createdAt)}</span>{task.assignee ? <i title={task.assignee.displayName}>{initials(task.assignee.displayName)}</i> : canClaim ? <button disabled={moving} onClick={(event) => { event.stopPropagation(); onClaim(); }}><UserRound /> Nhận việc</button> : <em>Chờ tiếp nhận</em>}</footer>
  </article>;
}

function TaskDetail({ task, session, onClose, onMove, onChanged }: { task: WorkTask; session: AuthSession; onClose: () => void; onMove: (column: BoardColumn) => Promise<void>; onChanged: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(task.progressPercent);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [estimateHours, setEstimateHours] = useState(task.estimatedMinutes ? String(Math.round((task.estimatedMinutes / 60) * 100) / 100) : "");
  const [assignees, setAssignees] = useState<WorkTaskPerson[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: task.title, description: task.description, teamId: task.teamId || "", assigneeId: task.assignee?.id || "", priority: task.priority, dueAt: dateTimeInput(task.dueAt) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const isAdmin = session.user.role === "ADMIN";
  const canManageTask = isAdmin || session.user.role === "MANAGER";
  const currentColumn = COLUMNS.find((column) => column.statuses.includes(task.status));
  const canManageChecklist = isAdmin || session.user.role === "MANAGER";
  const canEditTask = canManageChecklist && ["DRAFT", "ASSIGNED", "ACCEPTED"].includes(task.status);
  const canClaim = !task.archivedAt && !task.assignee && task.status === "DRAFT" && !isAdmin;
  const canRelease = !task.archivedAt && Boolean(task.assignee) && !task.startedAt && ["ASSIGNED", "ACCEPTED"].includes(task.status) && (canManageTask || task.assignee?.id === session.user.id);
  const canEstimate = !["COMPLETED", "CANCELED"].includes(task.status) && (isAdmin || session.user.role === "MANAGER" || task.assignee?.id === session.user.id);
  const checklist = task.checklistItems || [];
  const checklistCompleted = checklist.filter((item) => item.isCompleted).length;
  const checklistLocked = ["COMPLETED", "CANCELED"].includes(task.status);
  const workedSeconds = activeSeconds(task, clock);
  const timeStatus = estimateStatus(task, clock);
  const overrunSeconds = task.estimatedMinutes ? Math.max(0, workedSeconds - task.estimatedMinutes * 60) : 0;
  const teams = Array.from(new Map(assignees.flatMap((person) => person.team ? [[person.team.id, person.team]] : [])).values());
  const availableAssignees = draft.teamId ? assignees.filter((person) => person.teamId === draft.teamId) : [];
  const nextActions = isAdmin
    ? COLUMNS.filter((column) => column.id !== currentColumn?.id)
    : COLUMNS.filter((column) => task.status === "ASSIGNED" ? column.dropStatus === "IN_PROGRESS" : ["ACCEPTED", "IN_PROGRESS", "BLOCKED", "REJECTED"].includes(task.status) && ["IN_PROGRESS", "IN_REVIEW"].includes(column.dropStatus));

  useEffect(() => { setProgress(task.progressPercent); }, [task.progressPercent]);
  useEffect(() => { setEstimateHours(task.estimatedMinutes ? String(Math.round((task.estimatedMinutes / 60) * 100) / 100) : ""); }, [task.estimatedMinutes]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!editing) setDraft({ title: task.title, description: task.description, teamId: task.teamId || "", assigneeId: task.assignee?.id || "", priority: task.priority, dueAt: dateTimeInput(task.dueAt) });
  }, [task, editing]);

  async function startEditing() {
    setError(null);
    if (!assignees.length) {
      try { setAssignees(await api.taskAssignees(task.departmentCode)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải danh sách thành viên"); return; }
    }
    setEditing(true);
  }

  async function saveTaskDetails() {
    setSaving(true); setError(null);
    try {
      await api.updateTask(task.id, {
        title: draft.title,
        description: draft.description,
        teamId: draft.teamId,
        assigneeId: draft.assigneeId,
        priority: draft.priority,
        dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null
      });
      setEditing(false);
      await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu thay đổi"); }
    finally { setSaving(false); }
  }

  async function submitUpdate(event: FormEvent) { event.preventDefault(); if (!message.trim()) return; setSaving(true); setError(null); try { await api.addTaskUpdate(task.id, { message, progressPercent: checklist.length ? undefined : progress }); setMessage(""); await onChanged(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật"); } finally { setSaving(false); } }
  async function toggleChecklist(itemId: string, isCompleted: boolean) { setSaving(true); setError(null); try { await api.updateTaskChecklistItem(task.id, itemId, { isCompleted }); await onChanged(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật checklist"); } finally { setSaving(false); } }
  async function addChecklist(event: FormEvent) { event.preventDefault(); if (!checklistTitle.trim()) return; setSaving(true); setError(null); try { await api.addTaskChecklistItem(task.id, checklistTitle.trim()); setChecklistTitle(""); await onChanged(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể thêm checklist"); } finally { setSaving(false); } }
  async function removeChecklist(itemId: string) { setSaving(true); setError(null); try { await api.removeTaskChecklistItem(task.id, itemId); await onChanged(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xóa checklist"); } finally { setSaving(false); } }
  async function saveEstimate() {
    const hours = Number(estimateHours);
    if (!Number.isFinite(hours) || hours < 0.1) { setError("Thời gian dự kiến tối thiểu là 0,1 giờ"); return; }
    setSaving(true); setError(null);
    try { await api.updateTask(task.id, { estimatedMinutes: Math.round(hours * 60) }); await onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu thời gian dự kiến"); }
    finally { setSaving(false); }
  }

  async function archiveOrRestore() {
    setSaving(true); setError(null);
    try {
      if (task.archivedAt) await api.restoreTask(task.id);
      else await api.archiveTask(task.id);
      await onChanged();
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật lưu trữ"); }
    finally { setSaving(false); }
  }

  async function cancelTask() {
    if (!window.confirm("Hủy công việc này? Công việc sẽ được chuyển vào Lưu trữ và vẫn giữ toàn bộ lịch sử.")) return;
    setSaving(true); setError(null);
    try {
      await api.updateTask(task.id, { status: "CANCELED", message: "Đã hủy công việc" });
      await onChanged();
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể hủy công việc"); }
    finally { setSaving(false); }
  }

  async function claimOrRelease() {
    setSaving(true); setError(null);
    try {
      if (canClaim) await api.claimTask(task.id);
      else await api.releaseTask(task.id);
      await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật người phụ trách"); }
    finally { setSaving(false); }
  }

  return <div className="tm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !editing) onClose(); }}><section className="tm-detail" role="dialog" aria-modal="true" aria-labelledby="tm-detail-title">
    <header><div className="tm-detail-heading"><small>{task.code}</small>{editing ? <input id="tm-detail-title" className="tm-edit-title" maxLength={160} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /> : <h2 id="tm-detail-title">{task.title}</h2>}<div><span className={`tm-status ${STATUS[task.status].tone}`}>{STATUS[task.status].label}</span><span className={`tm-priority ${task.priority.toLowerCase()}`}>Ưu tiên {PRIORITY[task.priority].toLowerCase()}</span>{task.archivedAt && <span className="tm-status neutral">Đã lưu trữ</span>}{isOverdue(task) && <span className="tm-overdue">Đã quá hạn</span>}</div></div><div className="tm-detail-header-actions">{(canClaim || canRelease) && !editing && <button className="tm-claim-button" disabled={saving} onClick={() => void claimOrRelease()}>{canClaim ? <UserRound /> : <RotateCcw />}{canClaim ? "Nhận việc" : "Trả lại"}</button>}{canManageTask && (task.archivedAt || ["COMPLETED", "CANCELED"].includes(task.status)) && !editing && <button className="tm-archive-button" disabled={saving} onClick={() => void archiveOrRestore()}>{task.archivedAt ? <RotateCcw /> : <Archive />}{task.archivedAt ? "Khôi phục" : "Lưu trữ"}</button>}{canEditTask && !editing && <button className="tm-edit-button" onClick={() => void startEditing()}><Pencil /> Chỉnh sửa</button>}{editing && <><button className="tm-edit-cancel" disabled={saving} onClick={() => setEditing(false)}>Hủy</button><button className="tm-edit-save" disabled={saving || !draft.title.trim() || !draft.description.trim()} onClick={() => void saveTaskDetails()}>{saving ? "Đang lưu..." : <><Save /> Lưu</>}</button></>}<button className="tm-close" disabled={saving} onClick={onClose}><X /></button></div></header>
    <div className="tm-detail-body"><div className="tm-detail-main"><section><h3>Mô tả công việc</h3>{editing ? <textarea className="tm-edit-description" maxLength={5000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /> : <p className="tm-description">{task.description}</p>}</section><section><div className="tm-section-title"><h3><ListChecks />{checklist.length || canManageChecklist ? "Checklist" : "Tiến độ"}</h3><strong>{checklist.length ? `${checklistCompleted}/${checklist.length} hoàn thành` : `${progress}%`}</strong></div>{checklist.length > 0 ? <><div className="tm-checklist-progress"><i style={{ width: `${task.progressPercent}%` }} /></div><div className="tm-checklist-list">{checklist.map((item) => <div key={item.id} className={item.isCompleted ? "completed" : ""}><label><input type="checkbox" checked={item.isCompleted} disabled={saving || checklistLocked} onChange={(event) => void toggleChecklist(item.id, event.target.checked)} /><span>{item.title}</span></label>{canManageChecklist && !checklistLocked && <button type="button" aria-label={`Xóa ${item.title}`} disabled={saving} onClick={() => void removeChecklist(item.id)}><Trash2 /></button>}</div>)}</div></> : !canManageChecklist && <input className="tm-range" type="range" min="0" max="100" step="5" value={progress} disabled={task.status === "COMPLETED"} onChange={(event) => setProgress(Number(event.target.value))} />}{canManageChecklist && !checklistLocked && <form className="tm-checklist-add" onSubmit={addChecklist}><input maxLength={240} value={checklistTitle} onChange={(event) => setChecklistTitle(event.target.value)} placeholder={checklist.length ? "Thêm mục checklist..." : "Thêm tiêu chí hoàn thành..."} /><button disabled={saving || !checklistTitle.trim()}><Plus /> Thêm</button></form>}</section>{error && <div className="tm-error"><AlertCircle />{error}</div>}<section><h3><MessageSquareText />Hoạt động</h3><form className="tm-comment" onSubmit={submitUpdate}><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Viết cập nhật hoặc nhắc tên thành viên..." /><button disabled={saving || !message.trim()}><Send /></button></form><div className="tm-timeline">{task.updates?.map((update) => <article key={update.id}><i>{initials(update.actor.displayName)}</i><div><strong>{update.actor.displayName}</strong><p>{update.message || (update.toStatus ? `Chuyển sang ${STATUS[update.toStatus].label}` : "Đã cập nhật công việc")}</p><small>{formatTime(update.createdAt)}{update.progressPercent !== null ? ` · Tiến độ ${update.progressPercent}%` : ""}</small></div></article>)}</div></section></div>
      <aside className={`tm-detail-side ${editing ? "editing" : ""}`}><h3>Thông tin</h3>{editing ? <div className="tm-info-form"><label><span>Phòng ban</span><b>{task.departmentName}</b></label><label><span>Team</span><select value={draft.teamId} onChange={(event) => setDraft((current) => ({ ...current, teamId: event.target.value, assigneeId: "" }))}><option value="">Chưa xếp team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label><span>Người nhận</span><select value={draft.assigneeId} disabled={!draft.teamId} onChange={(event) => setDraft((current) => ({ ...current, assigneeId: event.target.value }))}><option value="">Chưa giao</option>{availableAssignees.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label><label><span>Mức ưu tiên</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as WorkTaskPriority }))}>{Object.entries(PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Thời hạn</span><input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))} /></label><label><span>Người giao</span><b>{task.createdBy.displayName}</b></label></div> : <>{timeStatus === "OVER" && <div className="tm-estimate-alert"><AlertCircle /><div><strong>Đã vượt thời gian ước tính {formatDuration(overrunSeconds)}</strong><span>Đã làm {formatDuration(workedSeconds)} trên kế hoạch {estimateLabel(task.estimatedMinutes)}.</span></div></div>}{timeStatus === "NEAR" && <div className="tm-estimate-alert near"><Clock3 /><div><strong>Sắp chạm thời gian ước tính</strong><span>Đã sử dụng {Math.round((estimateRatio(task, clock) || 0) * 100)}% thời gian dự kiến.</span></div></div>}<dl><div><dt>Phòng ban</dt><dd>{task.departmentName}</dd></div><div><dt>Team</dt><dd>{task.team?.name || "Chưa xếp team"}</dd></div><div><dt>Người nhận</dt><dd>{task.assignee?.displayName || "Chưa giao"}</dd></div><div><dt>Người giao</dt><dd>{task.createdBy.displayName}</dd></div><div><dt>Ngày giờ tạo</dt><dd>{formatDate(task.createdAt, true)}</dd></div><div><dt>Hạn hoàn thành</dt><dd>{formatDate(task.dueAt, true)}</dd></div><div><dt>Bắt đầu lần đầu</dt><dd>{task.startedAt ? formatDate(task.startedAt, true) : "Chưa bắt đầu"}</dd></div><div><dt>Hoàn thành lúc</dt><dd>{task.completedAt ? formatDate(task.completedAt, true) : "Chưa hoàn thành"}</dd></div><div><dt>Ước tính</dt><dd>{estimateLabel(task.estimatedMinutes)}</dd></div><div><dt>Thời gian đã làm</dt><dd className={`${task.activeTimerStartedAt ? "tm-running-time" : ""} ${timeStatus === "OVER" ? "tm-over-estimate" : ""}`}>{formatDuration(workedSeconds)}{task.activeTimerStartedAt ? " · đang tính" : ""}</dd></div><div><dt>Tiến độ</dt><dd>{task.progressPercent}%</dd></div></dl>{task.timeEntries && task.timeEntries.length > 0 && <div className="tm-time-sessions"><h4>Phiên làm việc gần đây</h4>{task.timeEntries.slice(0, 5).map((entry) => <div key={entry.id}><span><b>{entry.actor.displayName}</b><small>{formatDate(entry.startedAt, true)}{entry.endedAt ? ` – ${formatDate(entry.endedAt, true)}` : " – đang làm"}</small></span><strong>{formatDuration(entry.durationSeconds ?? (entry.endedAt ? 0 : Math.max(0, Math.floor((clock - new Date(entry.startedAt).getTime()) / 1000))))}</strong></div>)}</div>}{canEstimate && <div className="tm-estimate"><label><span>Ước tính thời gian hoàn thành</span><div><input type="number" min="0.1" max="8760" step="0.25" value={estimateHours} onChange={(event) => setEstimateHours(event.target.value)} placeholder="Ví dụ: 2.5" /><em>giờ</em></div></label><button disabled={saving || !estimateHours} onClick={() => void saveEstimate()}>{saving ? "Đang lưu..." : "Lưu ước tính"}</button></div>}</>}{!editing && !task.archivedAt && nextActions.length > 0 && <div className="tm-move-actions"><span>Chuyển công việc</span>{nextActions.map((column) => <button key={column.id} disabled={saving} onClick={() => void onMove(column)}><span className={`dot ${column.tone}`} />{column.title}<ChevronRight /></button>)}</div>}{isAdmin && !editing && !task.archivedAt && !["COMPLETED", "CANCELED"].includes(task.status) && <button className="tm-cancel-task" disabled={saving} onClick={() => void cancelTask()}>Hủy công việc</button>}</aside>
    </div>
  </section></div>;
}

function CreateTask({ departments, initialDepartmentCode, session, onClose, onCreated }: { departments: OrganizationDepartment[]; initialDepartmentCode: string; session: AuthSession; onClose: () => void; onCreated: (task: WorkTask) => void }) {
  const [departmentCode, setDepartmentCode] = useState(initialDepartmentCode); const [assignees, setAssignees] = useState<WorkTaskPerson[]>([]); const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [teamId, setTeamId] = useState(session.user.role === "MANAGER" ? session.user.teamId || "" : ""); const [assigneeId, setAssigneeId] = useState(""); const [priority, setPriority] = useState<WorkTaskPriority>("NORMAL"); const [dueAt, setDueAt] = useState(""); const [estimateHours, setEstimateHours] = useState(""); const [checklist, setChecklist] = useState<string[]>([]); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const department = departments.find((item) => item.code === departmentCode) || departments[0];
  useEffect(() => { if (!departmentCode) return; void api.taskAssignees(departmentCode).then(setAssignees).catch(() => setAssignees([])); }, [departmentCode]);
  const teams = (department?.teams || []).filter((team) => session.user.role !== "MANAGER" || !session.user.teamId || team.id === session.user.teamId);
  const availableAssignees = teamId ? assignees.filter((person) => person.teamId === teamId) : assignees;
  async function submit(event: FormEvent) { event.preventDefault(); if (!department) return; const estimate = estimateHours ? Number(estimateHours) : null; if (estimate !== null && (!Number.isFinite(estimate) || estimate < 0.1)) { setError("Thời gian ước tính tối thiểu là 0,1 giờ"); return; } setSaving(true); setError(null); try { onCreated(await api.createTask({ title, description, departmentCode: department.code, departmentName: department.name, teamId: teamId || undefined, agentId: department.agentId || undefined, priority, dueAt: new Date(dueAt).toISOString(), estimatedMinutes: estimate === null ? undefined : Math.round(estimate * 60), assigneeId: assigneeId || undefined, checklist: checklist.map((item) => item.trim()).filter(Boolean) })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể giao công việc"); setSaving(false); } }
  return <div className="tm-modal-backdrop"><form className="tm-create" onSubmit={submit}><header><div><h2>Giao công việc mới</h2><p>{department?.name || "Chọn phòng ban"}</p></div><button type="button" className="tm-close" onClick={onClose}><X /></button></header>{error && <div className="tm-error"><AlertCircle />{error}</div>}<div className="tm-form"><label><span>Phòng ban</span><select value={departmentCode} disabled={session.user.role === "MANAGER"} onChange={(event) => { setDepartmentCode(event.target.value); setTeamId(""); setAssigneeId(""); }} required>{departments.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}</select></label><label><span>Team phụ trách (tùy chọn)</span><select value={teamId} disabled={session.user.role === "MANAGER" && Boolean(session.user.teamId)} onChange={(event) => { setTeamId(event.target.value); setAssigneeId(""); }}><option value="">Toàn phòng ban</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label className="wide"><span>Tên công việc</span><input autoFocus required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Rà soát đơn hàng cần xử lý hôm nay" /></label><label className="wide"><span>Yêu cầu và kết quả cần đạt</span><textarea required maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mô tả rõ phạm vi, đầu ra và tiêu chí hoàn thành..." /></label><div className="tm-checklist-builder wide"><div><span>Checklist hoàn thành</span><button type="button" onClick={() => setChecklist((current) => [...current, ""])}><Plus /> Thêm tiêu chí</button></div>{checklist.length === 0 && <p>Thêm các đầu việc cụ thể để tiến độ được tính tự động.</p>}{checklist.map((item, index) => <div className="tm-checklist-draft" key={index}><input maxLength={240} value={item} onChange={(event) => setChecklist((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} placeholder={`Tiêu chí ${index + 1}`} /><button type="button" aria-label={`Xóa tiêu chí ${index + 1}`} onClick={() => setChecklist((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X /></button></div>)}</div><label><span>Người phụ trách (tùy chọn)</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Để phòng ban/team tiếp nhận</option>{availableAssignees.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label><label><span>Mức ưu tiên</span><select value={priority} onChange={(event) => setPriority(event.target.value as WorkTaskPriority)}>{Object.entries(PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Hạn hoàn thành</span><input type="datetime-local" value={dueAt} min={dateTimeInput(new Date().toISOString())} onChange={(event) => setDueAt(event.target.value)} required /></label><label><span>Ước tính thời gian</span><div className="tm-hours-input"><input type="number" min="0.1" max="8760" step="0.25" value={estimateHours} onChange={(event) => setEstimateHours(event.target.value)} placeholder="Ví dụ: 4" /><em>giờ</em></div></label></div><footer><button type="button" className="tm-secondary" onClick={onClose}>Hủy</button><button className="tm-primary" disabled={saving || !department || !dueAt}>{saving ? "Đang lưu..." : assigneeId ? "Giao công việc" : "Giao cho phòng ban/team"}<ArrowRight /></button></footer></form></div>;
}
