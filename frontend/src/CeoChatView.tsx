import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowClockwise, ArrowDown, Check, ChatCircle, Copy, DotsThree, FileText, List, NotePencil,
  PaperPlaneTilt, Plus, Robot, Sparkle, Stop, Trash, X
} from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { api } from "./api";
import type { ChatConversation, ChatMessage, ChatSource } from "./types";

const SUGGESTIONS = [
  "Tôi cần xin nghỉ phép như thế nào?",
  "Quy trình tạm ứng và hoàn ứng gồm những bước nào?",
  "Ai là đầu mối xử lý câu hỏi về chấm công?",
  "Trường hợp mua sắm khẩn cấp cần ghi nhận gì?"
];

const TIKTOK_SUGGESTIONS = [
  "Quy trình xử lý một sản phẩm mới trên TikTok gồm những bước nào?",
  "Ai phụ trách duyệt nội dung trước khi đăng?",
  "Quy định bàn giao tài khoản TikTok như thế nào?",
  "Khi có vấn đề với đơn TikTok cần báo cho ai?"
];

type KnowledgeChatVariant = "ceo" | "tiktok";

const CHAT_CONFIG = {
  ceo: {
    name: "CEO AI",
    subtitle: "Tri thức nội bộ",
    queryKey: "ceoConversation",
    placeholder: "Hỏi về nội quy, quy trình và tri thức nội bộ...",
    welcome: "Bạn cần tra cứu thông tin gì?",
    welcomeText: "Câu trả lời được đối chiếu với tài liệu nội bộ trong phạm vi bạn được phép xem.",
    suggestions: SUGGESTIONS
  },
  tiktok: {
    name: "TikTok AI",
    subtitle: "Phòng Sell TikTok",
    queryKey: "tiktokConversation",
    placeholder: "Hỏi về quy trình và tri thức Sell TikTok...",
    welcome: "Bạn cần hỗ trợ việc gì ở phòng TikTok?",
    welcomeText: "Câu trả lời dựa trên tài liệu Sell TikTok trong phạm vi bạn được phép xem.",
    suggestions: TIKTOK_SUGGESTIONS
  }
} as const;

function shortTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function sourceDate(value?: string | null) {
  if (!value) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function businessMarkdown(content: string, isAdmin: boolean) {
  if (isAdmin) return content;
  return content
    .split("\n")
    .filter((line) => !/(?:data\s*scope|capability|embedding|vector|chunk|prompt|tool\s*call|input\s*tokens?|output\s*tokens?|model\s*[:=]|database|sql\s+query|api\s+endpoint)/i.test(line))
    .join("\n")
    .replace(/`([^`]+)`/g, "$1");
}

function streamingMarkdown(content: string) {
  let stable = content;
  const boldMarkers = stable.match(/\*\*/g)?.length || 0;
  if (boldMarkers % 2 === 1) {
    const marker = stable.lastIndexOf("**");
    stable = `${stable.slice(0, marker)}${stable.slice(marker + 2)}`;
  }
  const codeMarkers = stable.match(/(?<!`)`(?!`)/g)?.length || 0;
  if (codeMarkers % 2 === 1) {
    const marker = stable.lastIndexOf("`");
    stable = `${stable.slice(0, marker)}${stable.slice(marker + 1)}`;
  }
  return stable;
}

export function CeoChatView({ isAdmin, variant = "ceo" }: { isAdmin: boolean; variant?: KnowledgeChatVariant }) {
  const config = CHAT_CONFIG[variant];
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipInitialConversationLoadRef = useRef<string | null>(null);
  const selectedId = searchParams.get(config.queryKey);

  function updateQuery(value: string | null, replace = false) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(config.queryKey, value); else next.delete(config.queryKey);
      return next;
    }, { replace });
  }

  async function loadConversations(preferredId?: string) {
    setLoading(true);
    try {
      const list = await (variant === "ceo" ? api.ceoChatConversations() : api.tiktokChatConversations());
      setConversations(list);
      const requested = preferredId || selectedId;
      const next = requested && list.some((item) => item.id === requested) ? requested : list[0]?.id;
      if (next !== selectedId) updateQuery(next || null, true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải hội thoại"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadConversations(); }, []);
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    if (skipInitialConversationLoadRef.current === selectedId) {
      skipInitialConversationLoadRef.current = null;
      return;
    }
    let active = true;
    const request = variant === "ceo" ? api.ceoChatConversation(selectedId) : api.tiktokChatConversation(selectedId);
    void request.then((conversation) => { if (active) setMessages(conversation.messages || []); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải hội thoại"); });
    return () => { active = false; };
  }, [selectedId]);
  useEffect(() => {
    const panel = messagesRef.current;
    if (panel && !showJump) requestAnimationFrame(() => panel.scrollTo({ top: panel.scrollHeight, behavior: sending ? "smooth" : "auto" }));
  }, [messages, status]);
  useEffect(() => {
    if (!composerRef.current) return;
    composerRef.current.style.height = "auto";
    composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 140)}px`;
  }, [question]);

  async function createConversation() {
    const created = await (variant === "ceo" ? api.createCeoChatConversation() : api.createTiktokChatConversation());
    setConversations((current) => [created, ...current]);
    setMessages([]); setQuestion(""); setHistoryOpen(false); updateQuery(created.id);
  }

  async function renameConversation(id: string) {
    if (!editingTitle.trim()) return;
    const updated = await (variant === "ceo" ? api.renameCeoChatConversation(id, editingTitle.trim()) : api.renameTiktokChatConversation(id, editingTitle.trim()));
    setConversations((current) => current.map((item) => item.id === id ? { ...item, title: updated.title } : item));
    setEditingId(null); setMenuId(null);
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Xóa cuộc trò chuyện này?")) return;
    await (variant === "ceo" ? api.deleteCeoChatConversation(id) : api.deleteTiktokChatConversation(id));
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining); setMenuId(null);
    if (selectedId === id) { setMessages([]); updateQuery(remaining[0]?.id || null, true); }
  }

  async function send(content: string, retryAssistantMessageId?: string) {
    if (!content.trim() || sending) return;
    let conversationId = selectedId;
    if (!conversationId) {
      const created = await (variant === "ceo" ? api.createCeoChatConversation() : api.createTiktokChatConversation());
      conversationId = created.id;
      skipInitialConversationLoadRef.current = created.id;
      setConversations((current) => [created, ...current]);
      updateQuery(created.id, true);
    }
    const now = new Date().toISOString();
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, conversationId, role: "USER", status: "COMPLETED", content: content.trim(), reportDate: null, agentRunId: null, sources: null, suggestions: null, error: null, createdAt: now, updatedAt: now };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = { ...userMessage, id: assistantId, role: "ASSISTANT", status: "PENDING", content: "" };
    setMessages((current) => retryAssistantMessageId
      ? current.map((message) => message.id === retryAssistantMessageId ? assistantMessage : message)
      : [...current, userMessage, assistantMessage]);
    setQuestion(""); setSending(true); setError(null); setShowJump(false); setStatus("Đang tìm tài liệu phù hợp...");
    const controller = new AbortController(); abortRef.current = controller;
    let sources: ChatSource[] = [];
    let streamBuffer = "";
    let streamTimer: ReturnType<typeof window.setTimeout> | null = null;
    let completedMessage: ChatMessage | null = null;
    let resolveVisualStream: (() => void) | null = null;
    const visualStreamDone = new Promise<void>((resolve) => { resolveVisualStream = resolve; });

    const finishVisualStream = () => {
      if (!completedMessage || streamBuffer) return;
      setMessages((current) => current.map((message) => message.id === assistantId ? completedMessage as ChatMessage : message));
      resolveVisualStream?.();
      resolveVisualStream = null;
    };
    const pumpStream = () => {
      streamTimer = null;
      if (!streamBuffer) { finishVisualStream(); return; }
      // Anthropic tool JSON arrives in a short burst. Pace that burst so React
      // can paint progressive Markdown instead of batching it into one frame.
      const characters = Array.from(streamBuffer);
      const chunk = characters.slice(0, 5).join("");
      streamBuffer = characters.slice(5).join("");
      setMessages((current) => current.map((message) => message.id === assistantId
        ? { ...message, content: message.content + chunk, sources }
        : message));
      streamTimer = window.setTimeout(pumpStream, 32);
    };
    const queueDelta = (text: string) => {
      streamBuffer += text;
      setStatus("");
      if (streamTimer === null) pumpStream();
    };
    try {
      const stream = variant === "ceo" ? api.streamCeoChatMessage : api.streamTiktokChatMessage;
      await stream(conversationId, content.trim(), {
        onStatus: setStatus,
        onMeta: (meta) => { sources = meta.sources; },
        onDelta: queueDelta,
        onDone: (completed) => { completedMessage = completed; finishVisualStream(); }
      }, controller.signal, retryAssistantMessageId);
      if (!completedMessage) throw new Error("Kết nối bị gián đoạn trước khi hoàn tất câu trả lời");
      await visualStreamDone;
      await loadConversations(conversationId);
    } catch (cause) {
      if (streamTimer !== null) window.clearTimeout(streamTimer);
      streamTimer = null;
      const stopped = cause instanceof DOMException && cause.name === "AbortError";
      const message = stopped ? "Đã dừng tạo câu trả lời." : cause instanceof Error ? cause.message : "Không thể hoàn tất câu trả lời";
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, status: stopped ? "CANCELED" : "FAILED", content: stopped ? message : "", error: stopped ? null : message } : item));
    } finally { abortRef.current = null; setSending(false); setStatus(""); }
  }

  function submit(event?: FormEvent, suggested?: string) { event?.preventDefault(); void send(suggested || question); }
  function retryAnswer(assistantMessageId: string) {
    const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
    const userMessage = [...messages.slice(0, assistantIndex)].reverse().find((message) => message.role === "USER");
    if (userMessage) void send(userMessage.content, assistantMessageId);
  }
  async function copy(message: ChatMessage) { await navigator.clipboard.writeText(message.content); setCopiedId(message.id); setTimeout(() => setCopiedId(null), 1500); }
  function handleScroll() { const panel = messagesRef.current; if (panel) setShowJump(panel.scrollHeight - panel.scrollTop - panel.clientHeight > 80); }

  return <section className={`lemiex-chat-shell ceo-chat-shell ${variant === "tiktok" ? "tiktok-chat-shell" : ""}`}>
    {historyOpen && <button className="chat-drawer-backdrop" onClick={() => setHistoryOpen(false)} aria-label="Đóng lịch sử" />}
    <aside className={`chat-history ${historyOpen ? "open" : ""}`}>
      <div className="chat-history-head"><h2>Cuộc trò chuyện</h2><div className="history-head-actions"><button onClick={() => void createConversation()} aria-label="Tạo hội thoại mới"><Plus weight="bold" /></button><button className="history-mobile-close" onClick={() => setHistoryOpen(false)}><X /></button></div></div>
      <div className="chat-history-list">{conversations.map((conversation) => <div className={`chat-history-item ${selectedId === conversation.id ? "active" : ""}`} key={conversation.id}>
        {editingId === conversation.id ? <form className="history-rename" onSubmit={(event) => { event.preventDefault(); void renameConversation(conversation.id); }}><input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} autoFocus /><button><Check /></button></form> : <button className="history-main" onClick={() => { updateQuery(conversation.id); setHistoryOpen(false); }}><ChatCircle /><span><strong>{conversation.title}</strong><small>{conversation._count?.messages || 0} tin nhắn · {shortTime(conversation.updatedAt)}</small></span></button>}
        {editingId !== conversation.id && <div className="history-menu-wrap"><button className="history-more" onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)}><DotsThree /></button>{menuId === conversation.id && <div className="history-menu"><button onClick={() => { setEditingId(conversation.id); setEditingTitle(conversation.title); }}><NotePencil /> Đổi tên</button><button className="danger" onClick={() => void deleteConversation(conversation.id)}><Trash /> Xóa</button></div>}</div>}
      </div>)}{!conversations.length && !loading && <div className="chat-history-empty"><ChatCircle /><span>Chưa có cuộc trò chuyện</span></div>}</div>
    </aside>
    <div className="chat-workspace">
      <header className="chat-agent-header"><button className="chat-history-toggle" onClick={() => setHistoryOpen(true)}><List /></button><div className={`chat-agent-avatar ${variant}`}><Robot weight="duotone" /></div><div className="chat-agent-title"><h2>{config.name}</h2><span>{config.subtitle}</span></div><div className="chat-online"><i /> Sẵn sàng</div></header>
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll} aria-live="polite">
        {!messages.length && <div className="chat-welcome"><div className={`chat-spark ${variant}`}><Sparkle weight="duotone" /></div><h2>{config.welcome}</h2><p>{config.welcomeText}</p><div className="chat-suggestions">{config.suggestions.map((item) => <button key={item} onClick={() => submit(undefined, item)}>{item}</button>)}</div></div>}
        {messages.map((message) => <CeoBubble key={message.id} message={message} isAdmin={isAdmin} agentName={config.name} variant={variant} copied={copiedId === message.id} retryDisabled={sending} onCopy={() => void copy(message)} onRetry={() => retryAnswer(message.id)} onSuggestion={(item) => void send(item)} />)}
        {status && <div className="chat-thinking"><span><i /><i /><i /></span>{status}</div>}
      </div>
      {showJump && <button className="chat-jump-latest" onClick={() => { setShowJump(false); messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" }); }}><ArrowDown /> Tin nhắn mới nhất</button>}
      {error && <div className="chat-error">{error}</div>}
      <form className="chat-composer ceo-composer" onSubmit={(event) => submit(event)}><textarea ref={composerRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={config.placeholder} rows={1} disabled={sending} />{sending ? <button type="button" className="stop-answer" onClick={() => abortRef.current?.abort()}><Stop weight="fill" /></button> : <button disabled={!question.trim()}><PaperPlaneTilt weight="fill" /></button>}</form>
    </div>
  </section>;
}

function CeoBubble({ message, isAdmin, agentName, variant, copied, retryDisabled, onCopy, onRetry, onSuggestion }: { message: ChatMessage; isAdmin: boolean; agentName: string; variant: KnowledgeChatVariant; copied: boolean; retryDisabled: boolean; onCopy: () => void; onRetry: () => void; onSuggestion: (item: string) => void }) {
  if (message.role === "USER") return <article className="chat-row user"><div className="chat-user-bubble">{message.content}</div></article>;
  const failed = message.status === "FAILED";
  return <article className="chat-row assistant"><div className={`chat-bot-mini ${variant}`}><Robot weight="duotone" /></div><div className={`chat-answer ${message.status.toLowerCase()}`}><div className="chat-answer-label"><strong>{agentName}</strong></div>
    {failed ? <div className="chat-failure"><strong>Chưa thể trả lời</strong><span>{message.error || "Vui lòng thử lại."}</span></div> : message.content ? <div className={`markdown-body ${message.status === "PENDING" ? "chat-streaming-text" : ""}`}><ReactMarkdown remarkPlugins={[remarkGfm]}>{businessMarkdown(message.status === "PENDING" ? streamingMarkdown(message.content) : message.content, isAdmin)}</ReactMarkdown>{message.status === "PENDING" && <span className="chat-streaming-caret" />}</div> : <div className="chat-answer-skeleton"><i /><i /><i /></div>}
    {message.sources?.length ? <div className="ceo-source-list"><span><FileText /> Nguồn tham chiếu</span>{message.sources.map((source, index) => <article key={source.chunkId || index}><div><strong>{source.title || source.label}</strong><small>{source.ownerDepartmentName} · v{source.versionNumber} · hiệu lực {sourceDate(source.effectiveFrom)}</small></div>{isAdmin && <em>{source.score ? `${Math.round(source.score * 100)}%` : ""}</em>}</article>)}</div> : null}
    {isAdmin && message.usage && <details className="chat-admin-meta"><summary>Chi tiết sử dụng</summary><div><span>{message.usage.model || "Không gọi model"}</span><span>{message.usage.inputTokens || 0} input</span><span>{message.usage.outputTokens || 0} output</span></div></details>}
    {message.status !== "PENDING" && <div className="chat-answer-actions">
      {message.status === "COMPLETED" && <button onClick={onCopy}>{copied ? <Check /> : <Copy />}{copied ? "Đã sao chép" : "Sao chép"}</button>}
      <button onClick={onRetry} disabled={retryDisabled}><ArrowClockwise /> Thử lại</button>
    </div>}
    {message.suggestions?.length ? <div className="chat-followups"><span>Có thể hỏi tiếp</span>{message.suggestions.map((item) => <button key={item} onClick={() => onSuggestion(item)}>{item}</button>)}</div> : null}
  </div></article>;
}
