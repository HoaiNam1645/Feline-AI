import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowClockwise, ArrowDown, CalendarBlank, Check, ChatCircle, Clock, Copy,
  DotsThree, List, NotePencil, Paperclip, PaperPlaneTilt, Plus, Robot,
  Sparkle, SpinnerGap, Stop, Trash, X
} from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { api } from "./api";
import type { ChatAttachment, ChatConversation, ChatMessage, ChatSource } from "./types";

const SUGGESTIONS = [
  "Hôm nay có bao nhiêu đơn và item mới?",
  "Shipout hôm nay thế nào?",
  "Backlog hiện tại có gì đáng chú ý?",
  "So sánh đơn mới hôm nay với hôm qua."
];

function todayInLemiexSystem() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function shortTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit"
  }).format(new Date(value));
}

function dataTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit", year: "numeric"
  }).format(new Date(value));
}

function reportDateLabel(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function friendlyChatError(value: string | null) {
  if (!value) return "Chưa thể hoàn tất câu trả lời. Vui lòng thử lại.";
  if (/unsupported numbers/i.test(value)) {
    return "Câu trả lời có số liệu chưa vượt qua bước xác minh nên chưa được hiển thị. Vui lòng thử lại.";
  }
  if (/markdown|tool output|required tool/i.test(value)) {
    return "Câu trả lời chưa đúng định dạng hiển thị. Vui lòng thử lại.";
  }
  return value;
}

function businessMarkdown(content: string, isAdmin: boolean) {
  if (isAdmin) return content;
  return content
    .replace(/\s*\((?:completedOrders|completedItems)\)/gi, "")
    .replace(/`?qc_pass`?/gi, "đạt QC");
}

function compactRepeatedFailures(messages: ChatMessage[]) {
  const compacted: ChatMessage[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const user = messages[index];
    const assistant = messages[index + 1];
    const isFailedPair = user?.role === "USER"
      && assistant?.role === "ASSISTANT"
      && (assistant.status === "FAILED" || assistant.status === "CANCELED");
    if (!isFailedPair) {
      compacted.push(user);
      continue;
    }
    const previousAssistant = compacted.at(-1);
    const previousUser = compacted.at(-2);
    if (
      previousUser?.role === "USER"
      && previousAssistant?.role === "ASSISTANT"
      && (previousAssistant.status === "FAILED" || previousAssistant.status === "CANCELED")
      && previousUser.content.trim() === user.content.trim()
    ) {
      compacted.splice(-2, 2);
    }
    compacted.push(user, assistant);
    index += 1;
  }
  return compacted;
}

export function LemiexChatView({ isAdmin }: { isAdmin: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const initialDate = searchParams.get("date");
  const [reportDate, setReportDate] = useState(
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayInLemiexSystem()
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const followOutputRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const selectedId = searchParams.get("conversation");
  const visibleMessages = compactRepeatedFailures(messages);

  function updateQuery(updates: Record<string, string | null>, replace = false) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      return next;
    }, { replace });
  }

  useEffect(() => {
    void loadConversations();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const date = searchParams.get("date");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) setReportDate(date);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let current = true;
    setError(null);
    void api.chatConversation(selectedId)
      .then((conversation) => {
        if (current) setMessages(conversation.messages || []);
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : "Không thể tải hội thoại");
      });
    return () => { current = false; };
  }, [selectedId]);

  useEffect(() => {
    const panel = messagesRef.current;
    if (!panel || (!followOutputRef.current && sending)) return;
    const frame = window.requestAnimationFrame(() => {
      panel.scrollTo({ top: panel.scrollHeight, behavior: sending ? "smooth" : "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, status]);

  useEffect(() => {
    const input = composerRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
  }, [question]);

  useEffect(() => {
    if (!previewAttachment) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewAttachment(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [previewAttachment]);

  function handleMessageScroll() {
    const panel = messagesRef.current;
    if (!panel) return;
    const distance = panel.scrollHeight - panel.scrollTop - panel.clientHeight;
    const atLatest = distance < 72;
    followOutputRef.current = atLatest;
    setShowJumpToLatest(!atLatest);
  }

  function jumpToLatest() {
    followOutputRef.current = true;
    setShowJumpToLatest(false);
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }

  async function loadConversations(preferredId?: string) {
    setLoading(true);
    try {
      const list = await api.chatConversations();
      setConversations(list);
      const requestedId = preferredId || selectedId;
      const nextId = requestedId && list.some((item) => item.id === requestedId) ? requestedId : list[0]?.id;
      if (nextId !== selectedId) updateQuery({ conversation: nextId || null }, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải hội thoại");
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(id: string) {
    setError(null);
    setHistoryOpen(false);
    updateQuery({ conversation: id });
  }

  async function newConversation() {
    const created = await api.createChatConversation();
    setConversations((current) => [created, ...current]);
    setMessages([]);
    setQuestion("");
    setPendingAttachments([]);
    setError(null);
    setHistoryOpen(false);
    updateQuery({ conversation: created.id });
  }

  async function renameConversation(id: string) {
    const title = editingTitle.trim();
    if (!title) return;
    const updated = await api.renameChatConversation(id, title);
    setConversations((current) => current.map((item) =>
      item.id === id ? { ...item, title: updated.title } : item
    ));
    setEditingId(null);
    setMenuId(null);
  }

  async function deleteConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (!window.confirm(`Xóa cuộc trò chuyện “${conversation?.title || "này"}”?`)) return;
    await api.deleteChatConversation(id);
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining);
    setMenuId(null);
    if (selectedId === id) {
      setMessages([]);
      updateQuery({ conversation: remaining[0]?.id || null }, true);
    }
  }

  async function submit(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    await sendQuestion((suggested ?? question).trim());
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length || uploading || sending) return;
    const remaining = 5 - pendingAttachments.length;
    const selected = Array.from(files).slice(0, remaining);
    if (!selected.length) {
      setError("Mỗi câu hỏi chỉ được đính kèm tối đa 5 ảnh.");
      return;
    }
    const invalid = selected.find((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 10 * 1024 * 1024);
    if (invalid) {
      setError("Chỉ hỗ trợ JPEG, PNG, WebP hoặc GIF; tối đa 10 MB mỗi ảnh.");
      return;
    }
    let conversationId = selectedId;
    if (!conversationId) {
      const created = await api.createChatConversation();
      conversationId = created.id;
      setConversations((current) => [created, ...current]);
      updateQuery({ conversation: created.id }, true);
    }
    setUploading(true);
    setError(null);
    try {
      const results = await Promise.allSettled(selected.map((file) => api.uploadChatAttachment(conversationId!, file)));
      const uploaded = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setPendingAttachments((current) => [...current, ...uploaded].slice(0, 5));
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") {
        setError(failed.reason instanceof Error ? failed.reason.message : "Có ảnh không thể tải lên");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải ảnh lên");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removePendingAttachment(attachment: ChatAttachment) {
    setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
    try {
      await api.deleteChatAttachment(attachment.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa ảnh");
    }
  }

  async function sendQuestion(
    content: string,
    retryAttachments?: ChatAttachment[],
    retryAssistantMessageId?: string
  ) {
    if (!content || sending) return;
    let conversationId = selectedId;
    if (!conversationId) {
      const created = await api.createChatConversation();
      conversationId = created.id;
      setConversations((current) => [created, ...current]);
      updateQuery({ conversation: created.id }, true);
    }
    const now = new Date().toISOString();
    const attachments = retryAttachments || pendingAttachments;
    const optimisticUser: ChatMessage = {
      id: `user-${Date.now()}`, conversationId, role: "USER", status: "COMPLETED",
      content, reportDate, agentRunId: null, sources: null, suggestions: null,
      error: null, createdAt: now, updatedAt: now, attachments
    };
    const assistantId = `assistant-${Date.now()}`;
    const optimisticAssistant: ChatMessage = {
      ...optimisticUser, id: assistantId, role: "ASSISTANT", status: "PENDING", content: ""
    };
    setMessages((current) => retryAssistantMessageId
      ? current.map((message) => message.id === retryAssistantMessageId ? optimisticAssistant : message)
      : [...current, optimisticUser, optimisticAssistant]
    );
    setPendingAttachments([]);
    followOutputRef.current = true;
    setShowJumpToLatest(false);
    setQuestion("");
    setSending(true);
    setError(null);
    setStatus("Đang kết nối Lemiex AI...");
    let sources: ChatSource[] = [];
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await api.streamChatMessage(conversationId, content, reportDate, {
        onStatus: setStatus,
        onMeta: (meta) => {
          sources = meta.sources;
          setReportDate(meta.reportDate);
          updateQuery({ date: meta.reportDate }, true);
        },
        onDelta: (text) => {
          setStatus("");
          setMessages((current) => current.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + text, sources }
              : message
          ));
        },
        onDone: (completed) => {
          setMessages((current) => current.map((message) =>
            message.id === assistantId ? completed : message
          ));
        }
      }, attachments.map((attachment) => attachment.id), controller.signal, retryAssistantMessageId);
      await loadConversations(conversationId);
    } catch (cause) {
      const stopped = cause instanceof DOMException && cause.name === "AbortError";
      const message = stopped
        ? "Đã dừng tạo câu trả lời."
        : cause instanceof Error ? cause.message : "Không thể hoàn tất câu trả lời";
      setMessages((current) => current.map((item) =>
        item.id === assistantId
          ? {
              ...item,
              status: stopped ? "CANCELED" : "FAILED",
              content: stopped ? message : "",
              error: stopped ? null : message
            }
          : item
      ));
    } finally {
      abortRef.current = null;
      setSending(false);
      setStatus("");
    }
  }

  function retryAnswer(assistantId: string) {
    const index = messages.findIndex((message) => message.id === assistantId);
    const previousIndex = [...messages.slice(0, index)]
      .map((message, messageIndex) => ({ message, messageIndex }))
      .reverse()
      .find(({ message }) => message.role === "USER")?.messageIndex;
    if (previousIndex === undefined) return;
    const previous = messages[previousIndex];
    void sendQuestion(previous.content, previous.attachments || [], assistantId);
  }

  async function copyAnswer(message: ChatMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  return <section className="lemiex-chat-shell">
    {historyOpen && <button className="chat-drawer-backdrop" onClick={() => setHistoryOpen(false)} aria-label="Đóng lịch sử" />}
    <aside className={`chat-history ${historyOpen ? "open" : ""}`}>
      <div className="chat-history-head"><h2>Cuộc trò chuyện</h2><div className="history-head-actions"><button onClick={() => void newConversation()} aria-label="Tạo hội thoại mới"><Plus weight="bold" /></button><button className="history-mobile-close" onClick={() => setHistoryOpen(false)} aria-label="Đóng"><X /></button></div></div>
      <div className="chat-history-list">
        {conversations.map((conversation) => <div className={`chat-history-item ${selectedId === conversation.id ? "active" : ""}`} key={conversation.id}>
          {editingId === conversation.id ? <form onSubmit={(event) => { event.preventDefault(); void renameConversation(conversation.id); }} className="history-rename"><input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} autoFocus maxLength={100} /><button><Check weight="bold" /></button></form> : <button className="history-main" onClick={() => void openConversation(conversation.id)}><ChatCircle /><span><strong>{conversation.title}</strong><small>{conversation._count?.messages || 0} tin nhắn · {shortTime(conversation.updatedAt)}</small></span></button>}
          {editingId !== conversation.id && <div className="history-menu-wrap"><button className="history-more" onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)} aria-label="Tùy chọn"><DotsThree weight="bold" /></button>{menuId === conversation.id && <div className="history-menu"><button onClick={() => { setEditingId(conversation.id); setEditingTitle(conversation.title); }}><NotePencil /> Đổi tên</button><button className="danger" onClick={() => void deleteConversation(conversation.id)}><Trash /> Xóa</button></div>}</div>}
        </div>)}
        {!conversations.length && !loading && <div className="chat-history-empty"><ChatCircle /><span>Chưa có cuộc trò chuyện</span></div>}
      </div>
    </aside>

    <div className="chat-workspace">
      <header className="chat-agent-header"><button className="chat-history-toggle" onClick={() => setHistoryOpen(true)} aria-label="Mở lịch sử trò chuyện"><List /></button><div className="chat-agent-avatar"><Robot weight="duotone" /></div><div className="chat-agent-title"><h2>Lemiex AI</h2><span>Trợ lý vận hành xưởng</span></div><div className="chat-online"><i /> Sẵn sàng</div></header>
      <div className="chat-messages" ref={messagesRef} onScroll={handleMessageScroll} aria-live="polite">
        {!messages.length && <div className="chat-welcome"><div className="chat-spark"><Sparkle weight="duotone" /></div><h2>Bạn muốn biết gì về xưởng?</h2><div className="chat-suggestions">{SUGGESTIONS.map((suggestion) => <button key={suggestion} onClick={() => void submit(undefined, suggestion)} disabled={sending}>{suggestion}</button>)}</div></div>}
        {visibleMessages.map((message) => <ChatBubble key={message.id} message={message} isAdmin={isAdmin} copied={copiedId === message.id} onCopy={() => void copyAnswer(message)} onRetry={() => retryAnswer(message.id)} onSuggestion={(suggestion) => void sendQuestion(suggestion)} onPreview={setPreviewAttachment} />)}
        {status && <div className="chat-thinking"><span><i /><i /><i /></span>{status}</div>}
      </div>
      {showJumpToLatest && <button className="chat-jump-latest" onClick={jumpToLatest}><ArrowDown weight="bold" /> Tin nhắn mới nhất</button>}
      {error && <div className="chat-error">{error}</div>}
      <form className="chat-composer" onSubmit={(event) => void submit(event)}>
        {pendingAttachments.length > 0 && <div className="chat-attachment-tray">{pendingAttachments.map((attachment) => <div className="chat-attachment-preview" key={attachment.id}><button type="button" className="chat-attachment-preview-open" onClick={() => setPreviewAttachment(attachment)} aria-label={`Xem ảnh ${attachment.originalName}`}><img src={attachment.contentUrl} alt={attachment.originalName} /></button><button type="button" className="chat-attachment-remove" onClick={() => void removePendingAttachment(attachment)} aria-label={`Xóa ${attachment.originalName}`}><X weight="bold" /></button></div>)}</div>}
        <label className="chat-date" title="Ngày dữ liệu"><CalendarBlank /><span>Ngày dữ liệu</span><input type="date" value={reportDate} onChange={(event) => { setReportDate(event.target.value); updateQuery({ date: event.target.value }, true); }} disabled={sending} aria-label="Ngày dữ liệu cần tra cứu" /></label>
        <input ref={fileInputRef} className="chat-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => void uploadImages(event.target.files)} />
        <button type="button" className="chat-attach-button" onClick={() => fileInputRef.current?.click()} disabled={sending || uploading || pendingAttachments.length >= 5} aria-label="Đính kèm ảnh">{uploading ? <SpinnerGap className="chat-upload-spinner" /> : <Paperclip />}</button>
        <textarea ref={composerRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Hỏi về đơn hàng, doanh thu, tồn kho..." rows={1} disabled={sending} aria-label="Nội dung câu hỏi" />
        {sending ? <button type="button" className="stop-answer" onClick={() => abortRef.current?.abort()} aria-label="Dừng trả lời"><Stop weight="fill" /></button> : <button type="submit" disabled={!question.trim()} aria-label="Gửi câu hỏi"><PaperPlaneTilt weight="fill" /></button>}
      </form>
    </div>
    {previewAttachment && <div className="chat-image-lightbox" role="dialog" aria-modal="true" aria-label={`Xem ảnh ${previewAttachment.originalName}`}>
      <button type="button" className="chat-image-lightbox-backdrop" onClick={() => setPreviewAttachment(null)} aria-label="Đóng xem ảnh" />
      <div className="chat-image-lightbox-panel">
        <button type="button" className="chat-image-lightbox-close" onClick={() => setPreviewAttachment(null)} aria-label="Đóng xem ảnh" autoFocus><X weight="bold" /></button>
        <img src={previewAttachment.contentUrl} alt={previewAttachment.originalName} />
      </div>
    </div>}
  </section>;
}

function ChatBubble({ message, isAdmin, copied, onCopy, onRetry, onSuggestion, onPreview }: {
  message: ChatMessage;
  isAdmin: boolean;
  copied: boolean;
  onCopy: () => void;
  onRetry: () => void;
  onSuggestion: (suggestion: string) => void;
  onPreview: (attachment: ChatAttachment) => void;
}) {
  if (message.role === "USER") {
    return <article className="chat-row user"><div className="chat-user-stack">{message.attachments?.length ? <div className="chat-message-images">{message.attachments.map((attachment) => <button type="button" className="chat-message-image" onClick={() => onPreview(attachment)} aria-label={`Xem ảnh ${attachment.originalName}`} key={attachment.id}><img src={attachment.contentUrl} alt={attachment.originalName} loading="lazy" /></button>)}</div> : null}{message.content && <div className="chat-user-bubble">{message.content}</div>}</div></article>;
  }
  const source = message.sources?.[0];
  const failed = message.status === "FAILED";
  return <article className="chat-row assistant"><div className="chat-bot-mini"><Robot weight="duotone" /></div><div className={`chat-answer ${message.status.toLowerCase()}`}>
    <div className="chat-answer-label"><strong>Lemiex AI</strong><span>{reportDateLabel(message.reportDate)}</span></div>
    {failed
      ? <div className="chat-failure"><strong>Chưa thể trả lời</strong><span>{friendlyChatError(message.error)}</span></div>
      : message.content
        ? message.status === "PENDING"
          ? <div className="markdown-body chat-streaming-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{businessMarkdown(message.content, isAdmin)}</ReactMarkdown><span className="chat-streaming-caret" aria-hidden="true" /></div>
          : <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{businessMarkdown(message.content, isAdmin)}</ReactMarkdown></div>
        : <div className="chat-answer-skeleton"><i /><i /><i /></div>}
    {source && <div className="chat-freshness"><Clock /><span>Cập nhật đến <strong>{dataTime(source.dataUpdatedAtUtc || source.generatedAtUtc)}</strong></span></div>}
    {isAdmin && message.usage && <details className="chat-admin-meta"><summary>Chi tiết sử dụng</summary><div><span>{message.usage.responseTimeMs === null ? "—" : `${(message.usage.responseTimeMs / 1000).toFixed(1)} giây`}</span><span>{(message.usage.inputTokens || 0).toLocaleString("vi-VN")} input</span><span>{(message.usage.outputTokens || 0).toLocaleString("vi-VN")} output</span><span>{message.usage.estimatedCostUsd === null ? "Chưa cấu hình giá" : `$${message.usage.estimatedCostUsd.toFixed(6)}`}</span></div></details>}
    {message.status !== "PENDING" && <div className="chat-answer-actions">{!failed && <button onClick={onCopy}>{copied ? <Check /> : <Copy />}{copied ? "Đã sao chép" : "Sao chép"}</button>}<button onClick={onRetry}><ArrowClockwise /> Thử lại</button></div>}
    {message.suggestions?.length ? <div className="chat-followups"><span>Có thể hỏi tiếp</span>{message.suggestions.map((suggestion) => <button key={suggestion} onClick={() => onSuggestion(suggestion)}>{suggestion}</button>)}</div> : null}
  </div></article>;
}
