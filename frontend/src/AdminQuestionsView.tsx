import { useEffect, useState } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "./api";
import type {
  ChatAnswerability,
  ChatQuestionEvaluation,
  ChatQuestionEvaluationList
} from "./types";

function time(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric"
  }).format(new Date(value));
}

function role(value?: string) {
  return ({ ADMIN: "Admin", MANAGER: "Manager", USER: "User" } as Record<string, string>)[value || ""] || "—";
}

export function AdminQuestionsView() {
  const [classification, setClassification] = useState<ChatAnswerability>("UNANSWERED");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ChatQuestionEvaluationList | null>(null);
  const [selected, setSelected] = useState<ChatQuestionEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await api.chatQuestionEvaluations({
        classification, userId, search: appliedSearch, page, limit: 30
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải danh sách câu hỏi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [classification, userId, appliedSearch, page]);

  async function changeClassification(item: ChatQuestionEvaluation) {
    const next = item.classification === "UNANSWERED" ? "ANSWERED" : "UNANSWERED";
    const updated = await api.updateChatQuestionEvaluation(item.id, next);
    setSelected(updated);
    await load();
  }

  const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 30)));
  return <section className="question-review-page">
    <div className="question-summary-grid">
      <button className={classification === "UNANSWERED" ? "active danger" : "danger"} onClick={() => { setClassification("UNANSWERED"); setPage(1); }}>
        <span><AlertCircle /></span><div><small>Chưa trả lời được</small><strong>{data?.summary.unanswered ?? 0}</strong></div>
      </button>
      <button className={classification === "ANSWERED" ? "active success" : "success"} onClick={() => { setClassification("ANSWERED"); setPage(1); }}>
        <span><Check /></span><div><small>Đã trả lời được</small><strong>{data?.summary.answered ?? 0}</strong></div>
      </button>
    </div>

    <div className="question-review-card">
      <div className="question-toolbar">
        <form onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); setPage(1); }}>
          <Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung câu hỏi hoặc người dùng" />
        </form>
        <select value={userId} onChange={(event) => { setUserId(event.target.value); setPage(1); }}>
          <option value="">Tất cả người dùng</option>
          {data?.users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.email}</option>)}
        </select>
      </div>
      {error && <div className="question-load-error"><AlertCircle />{error}</div>}
      <div className="question-table-wrap">
        <table className="question-table">
          <thead><tr><th>Người hỏi</th><th>Câu hỏi</th><th>Lý do phân loại</th><th>Thời gian</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {data?.items.map((item) => <tr key={item.id} onClick={() => setSelected(item)}>
              <td><strong>{item.user?.displayName || "Tài khoản đã xóa"}</strong><small>{item.user?.email || "—"} · {role(item.user?.role)}</small></td>
              <td><strong>{item.question}</strong><small>{item.answer.replace(/[*#_`]/g, "").slice(0, 130)}</small></td>
              <td><span>{item.reason || "—"}</span><small>{item.source === "ADMIN" ? "Admin đã review" : "Tự động phân loại"}</small></td>
              <td>{time(item.createdAt)}</td>
              <td><em className={`answerability ${item.classification.toLowerCase()}`}>{item.classification === "ANSWERED" ? "Đã trả lời" : "Chưa trả lời"}</em></td>
            </tr>)}
            {!loading && !data?.items.length && <tr><td colSpan={5}><div className="question-empty"><Check /><strong>Không có câu hỏi trong nhóm này</strong></div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="question-pagination"><span>{data?.total || 0} câu hỏi</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></button><strong>{page} / {pages}</strong><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight /></button></div></div>
    </div>
    {selected && <div className="question-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="question-drawer">
      <header><div><span>CHI TIẾT CÂU HỎI</span><h2>{selected.user?.displayName || "Tài khoản đã xóa"}</h2><p>{selected.user?.email || "—"} · {time(selected.createdAt)}</p></div><button onClick={() => setSelected(null)}><X /></button></header>
      <div className="question-drawer-body">
        <section><small>CÂU HỎI</small><p className="review-question">{selected.question}</p></section>
        <section><small>CÂU TRẢ LỜI</small><div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.answer}</ReactMarkdown></div></section>
        <section><small>PHÂN LOẠI</small><div className="review-reason"><em className={`answerability ${selected.classification.toLowerCase()}`}>{selected.classification === "ANSWERED" ? "Đã trả lời được" : "Chưa trả lời được"}</em><p>{selected.reason}</p><code>{selected.reasonCode}</code></div></section>
      </div>
      <footer><button onClick={() => void changeClassification(selected)}>{selected.classification === "UNANSWERED" ? <><Check /> Đánh dấu đã trả lời được</> : <><AlertCircle /> Chuyển về chưa trả lời</>}</button></footer>
    </aside></div>}
  </section>;
}
