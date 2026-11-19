import { Bot, Check, Circle, History, LoaderCircle, MessageSquarePlus, Send, Square, UsersRound, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "./api";
import type { ChatConversation, ChatMessage, MultiAgentId, MultiAgentParticipantResult } from "./types";

const AGENTS: Record<MultiAgentId, { name: string; short: string; tone: string }> = {
  "ceo-ai": { name: "CEO AI", short: "CEO", tone: "ceo" },
  "tiktok-ai": { name: "TikTok AI", short: "TikTok", tone: "tiktok" },
  "etsy-ai": { name: "Etsy AI", short: "Etsy", tone: "etsy" },
  "lemiex-ai": { name: "Lemiex AI", short: "Lemiex", tone: "lemiex" }
};

type AgentState = "WAITING" | "WORKING" | "DONE" | "FAILED";

function temporaryMessage(conversationId: string, role: "USER" | "ASSISTANT", content: string): ChatMessage {
  const now = new Date().toISOString();
  return { id: `multi-${role.toLowerCase()}-${Date.now()}`, conversationId, role, status: role === "USER" ? "COMPLETED" : "PENDING", content, reportDate: null, agentRunId: null, sources: null, suggestions: null, error: null, createdAt: now, updatedAt: now };
}

export function MultiAgentMeetingView({ availableAgentIds }: { availableAgentIds: MultiAgentId[] }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<MultiAgentId[]>([]);
  const [agentStates, setAgentStates] = useState<Partial<Record<MultiAgentId, AgentState>>>({});
  const [participantResults, setParticipantResults] = useState<MultiAgentParticipantResult[]>([]);
  const [status, setStatus] = useState("Sẵn sàng tiếp nhận nhiệm vụ");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const selectableAgents = useMemo(() => availableAgentIds.filter((id) => id !== "ceo-ai"), [availableAgentIds]);

  useEffect(() => { void initialize(); }, []);
  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: sending ? "smooth" : "auto" }); }, [messages, participantResults, sending]);

  async function initialize() {
    setLoading(true);
    setError(null);
    try {
      const list = await api.multiAgentConversations();
      setConversations(list);
      const active = list[0] || await api.createMultiAgentConversation();
      if (!list.length) setConversations([active]);
      await openConversation(active.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể mở Phòng điều hành AI");
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(id: string) {
    const detail = await api.multiAgentConversation(id);
    setConversation(detail);
    setMessages(detail.messages || []);
    setParticipantResults([]);
    setAgentStates({});
    setStatus("Sẵn sàng tiếp nhận nhiệm vụ");
    setHistoryOpen(false);
  }

  async function newConversation() {
    if (sending) return;
    const created = await api.createMultiAgentConversation();
    setConversations((current) => [created, ...current]);
    setConversation(created);
    setMessages([]);
    setParticipantResults([]);
    setAgentStates({});
    setQuestion("");
  }

  function toggleAgent(agentId: MultiAgentId) {
    if (sending) return;
    setSelected((current) => current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]);
  }

  async function send() {
    const content = question.trim();
    if (!conversation || !content || sending) return;
    if (!selectableAgents.length) {
      setError("Tài khoản chưa được cấp Agent chuyên môn để tham gia cuộc họp.");
      return;
    }
    const participants = selected;
    const userMessage = temporaryMessage(conversation.id, "USER", content);
    const assistantMessage = temporaryMessage(conversation.id, "ASSISTANT", "");
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setQuestion("");
    setError(null);
    setSending(true);
    setParticipantResults([]);
    setAgentStates(Object.fromEntries(participants.map((id) => [id, "WAITING"])));
    setStatus(participants.length ? "CEO AI đang phân công nhiệm vụ" : "CEO AI đang chọn Agent phù hợp");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await api.streamMultiAgentMessage(conversation.id, content, participants, {
        onMeetingStarted: ({ participants: routed }) => {
          setAgentStates(Object.fromEntries(routed.map((id) => [id, "WAITING"])));
          setStatus("Cuộc họp đã bắt đầu");
        },
        onAgentStarted: ({ agentId, agentName }) => {
          setAgentStates((current) => ({ ...current, [agentId]: "WORKING" }));
          setStatus(`${agentName} đang phân tích phần việc được giao`);
        },
        onAgentCompleted: (result) => {
          setParticipantResults((current) => [...current.filter((item) => item.agentId !== result.agentId), result]);
          setAgentStates((current) => ({ ...current, [result.agentId]: "DONE" }));
        },
        onAgentFailed: (result) => {
          setParticipantResults((current) => [...current.filter((item) => item.agentId !== result.agentId), result]);
          setAgentStates((current) => ({ ...current, [result.agentId]: "FAILED" }));
        },
        onSynthesisStarted: (message) => setStatus(message),
        onDelta: (text) => setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, content: message.content + text } : message)),
        onComplete: ({ assistantMessage: completed, participants: results }) => {
          setMessages((current) => current.map((message) => message.id === assistantMessage.id ? completed : message));
          setParticipantResults(results);
          setStatus("CEO AI đã hoàn tất biên bản cuộc họp");
        }
      }, controller.signal);
      const list = await api.multiAgentConversations();
      setConversations(list);
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "Cuộc họp chưa thể hoàn tất");
      setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, status: "FAILED", content: message.content || "Cuộc họp chưa thể hoàn tất." } : message));
      setStatus(controller.signal.aborted ? "Đã dừng cuộc họp" : "Cuộc họp bị gián đoạn");
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }

  if (loading) return <div className="multi-agent-loading"><LoaderCircle /><span>Đang mở Phòng điều hành AI...</span></div>;

  return <section className="multi-agent-shell">
    <aside className={`multi-agent-history ${historyOpen ? "open" : ""}`}>
      <div className="multi-history-head"><div><UsersRound /><span><strong>Phòng điều hành AI</strong><small>Các cuộc họp gần đây</small></span></div><button onClick={() => void newConversation()} aria-label="Tạo cuộc họp mới"><MessageSquarePlus /></button></div>
      <div className="multi-history-list">{conversations.map((item) => <button key={item.id} className={conversation?.id === item.id ? "active" : ""} onClick={() => void openConversation(item.id)}><strong>{item.title}</strong><span>{item._count?.messages || 0} lượt trao đổi</span></button>)}</div>
      <button className="multi-history-close" onClick={() => setHistoryOpen(false)} aria-label="Đóng lịch sử"><X /></button>
    </aside>
    {historyOpen && <button className="multi-history-backdrop" onClick={() => setHistoryOpen(false)} aria-label="Đóng lịch sử cuộc họp" />}

    <div className="multi-agent-workspace">
      <header className="multi-agent-header">
        <div><button className="multi-history-trigger" onClick={() => setHistoryOpen(true)} aria-label="Mở lịch sử cuộc họp"><History /></button><span className="multi-agent-mark"><Bot /></span><span><strong>CEO AI chủ trì</strong><small>{status}</small></span></div>
        <div className="multi-participant-picker" aria-label="Chọn Agent tham gia">
          <button className={`auto ${selected.length === 0 ? "selected" : ""}`} onClick={() => setSelected([])} aria-pressed={selected.length === 0}><span>Tự động</span>{selected.length === 0 && <Check />}</button>
          {selectableAgents.map((agentId) => <button key={agentId} className={`${AGENTS[agentId].tone} ${selected.includes(agentId) ? "selected" : ""}`} onClick={() => toggleAgent(agentId)} aria-pressed={selected.includes(agentId)}><span>{AGENTS[agentId].short}</span>{selected.includes(agentId) && <Check />}</button>)}
        </div>
      </header>

      <div className="multi-agent-stage">
        <div className="multi-stage-lead"><span className="multi-agent-mark"><Bot /></span><strong>CEO AI</strong><small>Điều phối</small></div>
        {Object.entries(agentStates).map(([id, state]) => {
          const agentId = id as MultiAgentId;
          return <div className={`multi-stage-agent ${AGENTS[agentId].tone} state-${state?.toLowerCase()}`} key={agentId}>
            <span>{state === "WORKING" ? <LoaderCircle className="spin" /> : state === "DONE" ? <Check /> : state === "FAILED" ? <XCircle /> : <Circle />}</span>
            <strong>{AGENTS[agentId].short}</strong>
            <small>{state === "WORKING" ? "Đang xử lý" : state === "DONE" ? "Đã gửi báo cáo" : state === "FAILED" ? "Chưa hoàn tất" : "Đang chờ"}</small>
          </div>;
        })}
      </div>

      <div className="multi-agent-messages" ref={messagesRef}>
        {!messages.length && <div className="multi-agent-empty"><UsersRound /><h2>Giao một mục tiêu, nhận một kế hoạch chung</h2><p>Chọn các phòng ban cần tham gia rồi giao nhiệm vụ cho CEO AI chủ trì.</p><div>{["Lập kế hoạch tăng thêm 20 đơn mỗi ngày", "Phân tích điểm nghẽn giữa bán hàng và fulfillment", "Đề xuất ưu tiên vận hành tuần này"].map((item) => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div></div>}
        {messages.map((message) => <article key={message.id} className={`multi-message ${message.role.toLowerCase()} ${message.status.toLowerCase()}`}>
          <div className="multi-message-meta"><strong>{message.role === "USER" ? "Bạn" : "Biên bản CEO AI"}</strong><span>{new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</span></div>
          <div className="multi-message-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || (sending ? "Đang tổng hợp..." : "")}</ReactMarkdown>{message.status === "PENDING" && <i className="multi-stream-caret" />}</div>
        </article>)}
        {participantResults.length > 0 && <section className="multi-agent-reports"><h3>Báo cáo thành phần</h3><div>{participantResults.map((result) => <details key={result.agentId} className={result.status === "FAILED" ? "failed" : ""}><summary><span className={`agent-report-dot ${AGENTS[result.agentId].tone}`} /><strong>{result.agentName}</strong><em>{result.status === "COMPLETED" ? "Đã gửi" : "Chưa hoàn tất"}</em></summary><div><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown || result.error || "Không có kết quả."}</ReactMarkdown></div></details>)}</div></section>}
      </div>

      {error && <div className="multi-agent-error"><XCircle /><span>{error}</span><button onClick={() => setError(null)}>Đóng</button></div>}
      <footer className="multi-agent-composer">
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Giao mục tiêu hoặc vấn đề cần các AI cùng phân tích..." rows={2} disabled={sending} />
        {sending ? <button className="stop" onClick={() => abortRef.current?.abort()} aria-label="Dừng cuộc họp"><Square /></button> : <button onClick={() => void send()} disabled={!question.trim()} aria-label="Bắt đầu cuộc họp"><Send /></button>}
      </footer>
    </div>
  </section>;
}
