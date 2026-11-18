import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  FilePenLine, MessageCircle, RefreshCw, Send, Users
} from "lucide-react";
import { api } from "./api";
import type { AuthSession, TeamDailyReport, TeamDailyReportStatus, TeamDailyReportTab } from "./types";
import { useSearchParams } from "react-router-dom";

type ReportDraft = Pick<TeamDailyReport, "summary" | "completedWork" | "inProgressWork" | "blockers" | "nextPlan">;

const EMPTY_DRAFT: ReportDraft = { summary: "", completedWork: "", inProgressWork: "", blockers: "", nextPlan: "" };

export function DailyReportsView({ session }: { session: AuthSession }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const openedReportId = useRef<string | null>(null);
  const [teams, setTeams] = useState<TeamDailyReportTab[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState(searchParams.get("team") || "");
  const [selectedDate, setSelectedDate] = useState(validCalendarDate(searchParams.get("date")) || todayVietnam());
  const [reports, setReports] = useState<TeamDailyReport[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) || null;
  const selectedReport = reports.find((report) => calendarValue(report.reportDate) === selectedDate) || null;
  const canWrite = session.user.role === "ADMIN" || session.user.role === "MANAGER";
  const canEditSelected = canWrite && selectedReport?.status !== "ACKNOWLEDGED";

  async function loadTeams(preferredTeamId?: string) {
    setLoadingTeams(true);
    try {
      const result = await api.dailyReportTeams(selectedDate);
      setTeams(result);
      setSelectedTeamId((current) => {
        const preferred = preferredTeamId || current;
        return result.some((team) => team.id === preferred) ? preferred : result[0]?.id || "";
      });
    } finally {
      setLoadingTeams(false);
    }
  }

  async function loadReports(teamId = selectedTeamId) {
    if (!teamId) {
      setReports([]);
      return;
    }
    setLoadingReports(true);
    try {
      const today = todayVietnam();
      const sixtyDaysAfter = shiftDate(selectedDate, 60);
      const end = selectedDate > today ? selectedDate : (sixtyDaysAfter < today ? sixtyDaysAfter : today);
      const result = await api.teamDailyReports(teamId, shiftDate(selectedDate, -60), end);
      setReports(result);
    } finally {
      setLoadingReports(false);
    }
  }

  useEffect(() => { void loadTeams(); }, [selectedDate]);
  useEffect(() => { if (selectedTeamId) void loadReports(selectedTeamId); }, [selectedTeamId, selectedDate]);
  useEffect(() => {
    const reportId = searchParams.get("report");
    if (!reportId || openedReportId.current === reportId) return;
    openedReportId.current = reportId;
    void api.teamDailyReport(reportId).then((report) => {
      setSelectedTeamId(report.teamId);
      setSelectedDate(calendarValue(report.reportDate));
      setReports((current) => current.some((item) => item.id === report.id) ? current : [report, ...current]);
    }).catch(() => {
      openedReportId.current = null;
      const next = new URLSearchParams(searchParams);
      next.delete("report");
      setSearchParams(next, { replace: true });
    });
  }, [searchParams]);
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedTeamId) next.set("team", selectedTeamId); else next.delete("team");
    next.set("date", selectedDate);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [selectedTeamId, selectedDate]);
  useEffect(() => {
    setEditing(false);
    setDraft(selectedReport ? reportDraft(selectedReport) : EMPTY_DRAFT);
  }, [selectedReport?.id, selectedDate]);

  const dateEntries = useMemo(() => {
    const values = new Set(reports.map((report) => calendarValue(report.reportDate)));
    values.add(selectedDate);
    values.add(todayVietnam());
    return [...values].sort().reverse().map((date) => ({ date, report: reports.find((item) => calendarValue(item.reportDate) === date) || null }));
  }, [reports, selectedDate]);

  async function refresh() {
    await Promise.all([loadTeams(selectedTeamId), loadReports(selectedTeamId)]);
  }

  function openEditor() {
    setDraft(selectedReport ? reportDraft(selectedReport) : EMPTY_DRAFT);
    setEditing(true);
  }

  async function saveReport(event: FormEvent) {
    event.preventDefault();
    if (!selectedTeamId) return;
    setSaving(true);
    try {
      const saved = selectedReport
        ? await api.updateTeamDailyReport(selectedReport.id, draft)
        : await api.createTeamDailyReport({ teamId: selectedTeamId, reportDate: selectedDate, ...draft });
      replaceReport(saved);
      setEditing(false);
      await loadTeams(selectedTeamId);
    } finally {
      setSaving(false);
    }
  }

  async function submitReport() {
    if (!selectedReport) return;
    setSaving(true);
    try {
      const submitted = await api.submitTeamDailyReport(selectedReport.id);
      replaceReport(submitted);
      await loadTeams(selectedTeamId);
    } finally {
      setSaving(false);
    }
  }

  async function acknowledgeReport() {
    if (!selectedReport) return;
    setSaving(true);
    try {
      const acknowledged = await api.acknowledgeTeamDailyReport(selectedReport.id);
      replaceReport(acknowledged);
      await loadTeams(selectedTeamId);
    } finally {
      setSaving(false);
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!selectedReport || !comment.trim()) return;
    setCommenting(true);
    try {
      const created = await api.commentTeamDailyReport(selectedReport.id, comment.trim());
      setReports((current) => current.map((report) => report.id === selectedReport.id
        ? { ...report, comments: [...report.comments, created] }
        : report));
      setComment("");
    } finally {
      setCommenting(false);
    }
  }

  function replaceReport(next: TeamDailyReport) {
    setReports((current) => current.some((report) => report.id === next.id)
      ? current.map((report) => report.id === next.id ? next : report)
      : [next, ...current].sort((a, b) => calendarValue(b.reportDate).localeCompare(calendarValue(a.reportDate))));
  }

  return <section className="daily-reports-page">
    <div className="daily-reports-toolbar">
      <div className="daily-team-tabs" role="tablist" aria-label="Danh sách team">
        {teams.map((team) => <button key={team.id} role="tab" aria-selected={team.id === selectedTeamId} className={team.id === selectedTeamId ? "active" : ""} onClick={() => setSelectedTeamId(team.id)}>
          <span><strong>{team.name}</strong><small>{team.department.name}</small></span>
          <TeamTabState report={team.report} />
        </button>)}
        {!loadingTeams && !teams.length && <div className="daily-no-team"><Users /> Chưa có team trong phạm vi của bạn.</div>}
      </div>
      <div className="daily-header-actions">
        <label className="daily-date-control"><CalendarDays /><span>Ngày xem</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <button className="daily-icon-button" onClick={() => void refresh()} aria-label="Làm mới" disabled={loadingTeams || loadingReports}><RefreshCw className={loadingTeams || loadingReports ? "spin" : ""} /></button>
      </div>
    </div>

    {selectedTeam && <div className="daily-report-workspace">
      <aside className="daily-date-rail">
        <div className="daily-rail-heading"><span>Lịch báo cáo</span><strong>{reports.length} báo cáo</strong></div>
        <div className="daily-date-list">
          {dateEntries.map(({ date, report }) => <button key={date} className={date === selectedDate ? "active" : ""} onClick={() => setSelectedDate(date)}>
            <span className="daily-calendar-tile"><b>{dayNumber(date)}</b><small>{monthLabel(date)}</small></span>
            <span className="daily-date-copy"><strong>{relativeDate(date)}</strong><small>{report ? statusLabel(report.status) : "Chưa có báo cáo"}</small></span>
            {report ? <StatusDot status={report.status} /> : <ChevronRight />}
          </button>)}
        </div>
      </aside>

      <main className="daily-report-main">
        {loadingReports ? <div className="daily-loading"><RefreshCw className="spin" /> Đang tải báo cáo...</div>
          : selectedReport ? <>
            <div className="daily-report-titlebar">
              <div><div className="daily-report-meta"><StatusPill status={selectedReport.status} /><span>{fullDate(selectedDate)}</span></div><h2>{selectedTeam.name}</h2><p>Người lập: {selectedReport.createdBy.displayName}{selectedReport.submittedAt ? ` · Gửi lúc ${dateTime(selectedReport.submittedAt)}` : ""}</p></div>
              <div className="daily-report-actions">
                {canEditSelected && <button className="daily-secondary-button" onClick={openEditor}><FilePenLine /> Chỉnh sửa</button>}
                {canEditSelected && selectedReport.status === "DRAFT" && <button className="daily-primary-button" onClick={() => void submitReport()} disabled={saving}><Send /> Gửi báo cáo</button>}
                {session.user.role === "ADMIN" && selectedReport.status === "SUBMITTED" && <button className="daily-primary-button" onClick={() => void acknowledgeReport()} disabled={saving}><Check /> Xác nhận đã xem</button>}
              </div>
            </div>
            {editing ? <ReportEditor draft={draft} setDraft={setDraft} saving={saving} onSubmit={saveReport} onCancel={() => setEditing(false)} /> : <ReportContent report={selectedReport} />}
            <Comments report={selectedReport} value={comment} setValue={setComment} submitting={commenting} onSubmit={addComment} />
          </> : editing ? <ReportEditor draft={draft} setDraft={setDraft} saving={saving} onSubmit={saveReport} onCancel={() => setEditing(false)} /> : <div className="daily-empty-report">
            <span className="daily-calendar-large"><b>{dayNumber(selectedDate)}</b><small>{monthLabel(selectedDate)}</small></span>
            <div><h2>Chưa có báo cáo ngày {shortDate(selectedDate)}</h2><p>{canWrite ? "Tạo báo cáo để ghi nhận kết quả và kế hoạch của team." : "Leader chưa gửi báo cáo cho ngày này."}</p>{canWrite && <button className="daily-primary-button" onClick={openEditor}><FilePenLine /> Tạo báo cáo</button>}</div>
          </div>}
      </main>
    </div>}
  </section>;
}

function ReportEditor({ draft, setDraft, saving, onSubmit, onCancel }: { draft: ReportDraft; setDraft: (value: ReportDraft) => void; saving: boolean; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  const field = (key: keyof ReportDraft, label: string, hint: string, required = false) => <label className="daily-editor-field"><span>{label}{required && <b> *</b>}</span><small>{hint}</small><textarea value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} rows={key === "summary" ? 3 : 5} required={required} /></label>;
  return <form className="daily-report-editor" onSubmit={onSubmit}>
    <div className="daily-editor-heading"><div><span>Soạn báo cáo</span><h2>Nội dung trong ngày</h2></div><div><button type="button" className="daily-secondary-button" onClick={onCancel}>Hủy</button><button className="daily-primary-button" disabled={saving}>{saving ? <RefreshCw className="spin" /> : <Check />} Lưu báo cáo</button></div></div>
    {field("summary", "Tóm tắt", "Điểm chính sếp cần nắm trong một nhịp đọc.", true)}
    <div className="daily-editor-grid">{field("completedWork", "Kết quả hôm nay", "Công việc, chỉ tiêu hoặc đầu ra đã hoàn thành.", true)}{field("inProgressWork", "Đang thực hiện", "Việc đang tiếp tục và trạng thái hiện tại.")}</div>
    <div className="daily-editor-grid">{field("blockers", "Vướng mắc / cần hỗ trợ", "Rủi ro, trở ngại hoặc quyết định cần sếp hỗ trợ.")}{field("nextPlan", "Kế hoạch tiếp theo", "Ưu tiên và kết quả dự kiến của ngày tiếp theo.", true)}</div>
  </form>;
}

function ReportContent({ report }: { report: TeamDailyReport }) {
  return <div className="daily-report-content">
    <ReportSection className="summary" title="Tóm tắt" value={report.summary} />
    <div className="daily-section-grid"><ReportSection title="Kết quả hôm nay" value={report.completedWork} /><ReportSection title="Đang thực hiện" value={report.inProgressWork} /></div>
    <div className="daily-section-grid"><ReportSection className="blockers" title="Vướng mắc / cần hỗ trợ" value={report.blockers} /><ReportSection title="Kế hoạch tiếp theo" value={report.nextPlan} /></div>
    {report.acknowledgedAt && <div className="daily-acknowledged"><CheckCircle2 /><span><strong>{report.acknowledgedBy?.displayName || "CEO"} đã xác nhận</strong><small>{dateTime(report.acknowledgedAt)}</small></span></div>}
  </div>;
}

function ReportSection({ title, value, className = "" }: { title: string; value: string; className?: string }) {
  return <article className={`daily-report-section ${className}`}><h3>{title}</h3><p>{value || "Không có nội dung."}</p></article>;
}

function Comments({ report, value, setValue, submitting, onSubmit }: { report: TeamDailyReport; value: string; setValue: (value: string) => void; submitting: boolean; onSubmit: (event: FormEvent) => void }) {
  return <section className="daily-comments">
    <div className="daily-comments-heading"><div><MessageCircle /><span><h3>Trao đổi</h3><small>{report.comments.length} bình luận</small></span></div></div>
    <div className="daily-comment-list">
      {!report.comments.length && <div className="daily-comments-empty">Chưa có trao đổi cho báo cáo này.</div>}
      {report.comments.map((item) => <article key={item.id} className="daily-comment"><span className="daily-avatar">{initials(item.actor.displayName)}</span><div><header><strong>{item.actor.displayName}</strong><span>{roleLabel(item.actor.role)}</span><time>{dateTime(item.createdAt)}</time></header><p>{item.message}</p></div></article>)}
    </div>
    <form className="daily-comment-composer" onSubmit={onSubmit}><textarea value={value} onChange={(event) => setValue(event.target.value)} rows={2} maxLength={3000} placeholder="Viết bình luận hoặc phản hồi cho team..." required /><button className="daily-primary-button" disabled={submitting || !value.trim()}>{submitting ? <RefreshCw className="spin" /> : <Send />} Gửi</button></form>
  </section>;
}

function TeamTabState({ report }: { report: TeamDailyReportTab["report"] }) {
  if (!report) return <i className="missing" title="Chưa có báo cáo" />;
  return <i className={report.status.toLowerCase()} title={statusLabel(report.status)} />;
}

function StatusDot({ status }: { status: TeamDailyReportStatus }) { return <i className={`daily-status-dot ${status.toLowerCase()}`} />; }
function StatusPill({ status }: { status: TeamDailyReportStatus }) { return <span className={`daily-status-pill ${status.toLowerCase()}`}>{statusLabel(status)}</span>; }
function statusLabel(status: TeamDailyReportStatus) { return { DRAFT: "Bản nháp", SUBMITTED: "Đã gửi", ACKNOWLEDGED: "Đã xác nhận" }[status]; }
function roleLabel(role: string) { return { ADMIN: "CEO", MANAGER: "Leader", USER: "Thành viên" }[role] || role; }
function reportDraft(report: TeamDailyReport): ReportDraft { return { summary: report.summary, completedWork: report.completedWork, inProgressWork: report.inProgressWork, blockers: report.blockers, nextPlan: report.nextPlan }; }
function calendarValue(value: string) { return value.slice(0, 10); }
function validCalendarDate(value: string | null) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : ""; }
function todayVietnam() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function shiftDate(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function dateFromValue(value: string) { return new Date(`${value}T12:00:00+07:00`); }
function dayNumber(value: string) { return value.slice(8, 10); }
function monthLabel(value: string) { return `TH${Number(value.slice(5, 7))}`; }
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(dateFromValue(value)); }
function fullDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(dateFromValue(value)); }
function relativeDate(value: string) { const today = todayVietnam(); if (value === today) return "Hôm nay"; if (value === shiftDate(today, -1)) return "Hôm qua"; return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(dateFromValue(value)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); }
function initials(value: string) { return value.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join(""); }
