import type {
  AgentDefinition,
  AgentRun,
  AuthSession,
  AccessCatalog,
  DailyMetrics,
  DailyReport,
  ManagedAccessGrant,
  ManagedUser,
  UserRole,
  ChatConversation,
  ChatMessage,
  ChatSource,
  ChatAnswerability,
  ChatQuestionEvaluation,
  ChatQuestionEvaluationList
  ,ChatAttachment,
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  KnowledgeList,
  KnowledgeSearchResult
  ,OfficeDelegationResult
  ,OfficeDelegationStage
  ,TiktokDashboardData
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export interface ChatStreamHandlers {
  onStatus?: (message: string) => void;
  onMeta?: (data: {
    userMessage: ChatMessage;
    assistantMessageId: string;
    reportDate: string;
    runId: string;
    sources: ChatSource[];
  }) => void;
  onDelta: (text: string) => void;
  onDone?: (message: ChatMessage) => void;
}

export interface CeoChatStreamHandlers {
  onStatus?: (message: string) => void;
  onMeta?: (data: { userMessage: ChatMessage; assistantMessageId: string; runId: string; sources: ChatSource[] }) => void;
  onDelta: (text: string) => void;
  onDone?: (message: ChatMessage) => void;
}

export interface OfficeDelegationHandlers {
  onStage?: (stage: OfficeDelegationStage, message: string) => void;
  onResult?: (result: OfficeDelegationResult) => void;
  onDone?: (runId: string) => void;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Yêu cầu thất bại (${response.status})`) as Error & {
      status?: number;
    };
    error.status = response.status;
    if (response.status === 401 && path !== "/auth/login") {
      window.dispatchEvent(new CustomEvent("feline:session-expired"));
    }
    throw error;
  }
  return data as T;
}

async function multipartRequest<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: form
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent("feline:session-expired"));
    throw new Error(data?.message || `Yêu cầu thất bại (${response.status})`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) => request<{ expiresAt: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }),
  me: () => request<AuthSession>("/auth/me"),
  logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; reauthenticationRequired: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    }),
  adminUsers: () => request<ManagedUser[]>("/admin/users"),
  accessCatalog: () => request<AccessCatalog>("/admin/access-catalog"),
  createUser: (input: { email: string; displayName: string; departmentCode?: string; role: UserRole; password: string }) =>
    request<ManagedUser>("/admin/users", { method: "POST", body: JSON.stringify(input) }),
  updateUser: (id: string, input: { displayName?: string; departmentCode?: string; role?: UserRole; status?: string; password?: string }) =>
    request<ManagedUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  createGrant: (input: Omit<ManagedAccessGrant, "id" | "createdAt"> & { userId: string }) =>
    request<ManagedAccessGrant>("/admin/access-grants", { method: "POST", body: JSON.stringify(input) }),
  updateGrant: (id: string, input: Partial<Omit<ManagedAccessGrant, "id" | "createdAt">>) =>
    request<ManagedAccessGrant>(`/admin/access-grants/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  revokeGrant: (id: string) => request<{ success: boolean }>(`/admin/access-grants/${id}`, { method: "DELETE" }),
  chatQuestionEvaluations: (filters: {
    classification?: ChatAnswerability;
    userId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return request<ChatQuestionEvaluationList>(`/admin/chat-question-evaluations?${query}`);
  },
  updateChatQuestionEvaluation: (
    id: string,
    classification: ChatAnswerability,
    reason?: string
  ) => request<ChatQuestionEvaluation>(`/admin/chat-question-evaluations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ classification, reason })
  }),
  knowledgeDocuments: (filters: { agentId?: string; search?: string; status?: KnowledgeDocumentStatus | "ALL"; department?: string } = {}) => {
    const query = new URLSearchParams();
    if (filters.agentId) query.set("agentId", filters.agentId);
    if (filters.search) query.set("search", filters.search);
    if (filters.status && filters.status !== "ALL") query.set("status", filters.status);
    if (filters.department) query.set("department", filters.department);
    const suffix = query.size ? `?${query}` : "";
    return request<KnowledgeList>(`/knowledge/documents${suffix}`);
  },
  knowledgeDocument: (id: string) => request<KnowledgeDocument>(`/knowledge/documents/${id}`),
  knowledgeSearch: (query: string, limit = 8, agentId = "ceo-ai") => request<KnowledgeSearchResult[]>("/knowledge/search", {
    method: "POST",
    body: JSON.stringify({ query, limit, agentId })
  }),
  uploadKnowledgeDocument: (input: {
    agentId: string;
    file: File;
    title: string;
    category: string;
    description?: string;
    ownerDepartmentCode: string;
    ownerDepartmentName: string;
    ownerName: string;
    allowedDepartments: string[];
    effectiveFrom?: string;
    effectiveTo?: string;
    status: KnowledgeDocumentStatus;
    sourceUrl?: string;
  }) => {
    const form = new FormData();
    Object.entries(input).forEach(([key, value]) => {
      if (key === "file") form.append("file", value as File);
      else if (key === "allowedDepartments") form.append(key, JSON.stringify(value));
      else if (value !== undefined && value !== "") form.append(key, String(value));
    });
    return multipartRequest<KnowledgeDocument>("/knowledge/documents", form);
  },
  uploadKnowledgeVersion: (id: string, input: { file: File; effectiveFrom?: string; effectiveTo?: string; sourceUrl?: string }) => {
    const form = new FormData();
    form.append("file", input.file);
    if (input.effectiveFrom) form.append("effectiveFrom", input.effectiveFrom);
    if (input.effectiveTo) form.append("effectiveTo", input.effectiveTo);
    if (input.sourceUrl) form.append("sourceUrl", input.sourceUrl);
    return multipartRequest<KnowledgeDocument>(`/knowledge/documents/${id}/versions`, form);
  },
  updateKnowledgeDocument: (id: string, input: Partial<{
    title: string;
    category: string;
    description: string;
    ownerDepartmentCode: string;
    ownerDepartmentName: string;
    ownerName: string;
    status: KnowledgeDocumentStatus;
    allowedDepartments: string[];
  }>) => request<KnowledgeDocument>(`/knowledge/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  }),
  reindexKnowledgeDocument: (id: string) => request<KnowledgeDocument>(`/knowledge/documents/${id}/reindex`, { method: "POST" }),
  removeMockKnowledge: (agentId = "ceo-ai") => request<{ removed: number }>(`/knowledge/mock-documents?agentId=${encodeURIComponent(agentId)}`, { method: "DELETE" }),
  health: () => request<{ status: string; timestamp: string }>("/health"),
  tiktokDashboard: (startDate: string, endDate: string) => request<TiktokDashboardData>(`/tiktok/dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`),
  sourceHealth: () => request<Record<string, unknown>>("/metrics/source/health"),
  dailyMetrics: (date: string) => request<DailyMetrics>(`/metrics/workshop/daily/${date}`),
  dailyReport: async (date: string): Promise<DailyReport | null> => {
    try {
      return await request<DailyReport>(`/reports/workshop/daily/${date}`);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 404) return null;
      throw error;
    }
  },
  definition: () => request<AgentDefinition>("/agents/lemiex"),
  runs: (limit = 30) => request<AgentRun[]>(`/agents/lemiex/runs?limit=${limit}`),
  runDailyReview: (reportDate: string) => request<AgentRun>("/agents/lemiex/runs", {
    method: "POST",
    body: JSON.stringify({ capabilityId: "lemiex.operations.daily-review", input: { reportDate } })
  }),
  chatConversations: () => request<ChatConversation[]>("/chat/lemiex/conversations"),
  createChatConversation: () => request<ChatConversation>("/chat/lemiex/conversations", {
    method: "POST",
    body: JSON.stringify({})
  }),
  chatConversation: (id: string) => request<ChatConversation>(`/chat/lemiex/conversations/${id}`),
  renameChatConversation: (id: string, title: string) => request<ChatConversation>(`/chat/lemiex/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title })
  }),
  deleteChatConversation: (id: string) => request<{ success: boolean }>(`/chat/lemiex/conversations/${id}`, {
    method: "DELETE"
  }),
  uploadChatAttachment: async (conversationId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API_BASE}/chat/lemiex/conversations/${conversationId}/attachments`, {
      method: "POST",
      credentials: "include",
      body: form
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `Tải ảnh thất bại (${response.status})`);
    return data as ChatAttachment;
  },
  deleteChatAttachment: (attachmentId: string) => request<{ success: boolean }>(
    `/chat/lemiex/attachments/${attachmentId}`,
    { method: "DELETE" }
  ),
  streamChatMessage: async (
    conversationId: string,
    content: string,
    reportDate: string,
    handlers: ChatStreamHandlers,
    attachmentIds: string[] = [],
    signal?: AbortSignal,
    retryAssistantMessageId?: string
  ) => {
    const response = await fetch(`${API_BASE}/chat/lemiex/conversations/${conversationId}/messages/stream`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({ content, reportDate, attachmentIds, retryAssistantMessageId })
    });
    if (!response.ok || !response.body) {
      if (response.status === 401) window.dispatchEvent(new CustomEvent("feline:session-expired"));
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || `Yêu cầu thất bại (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === "status") handlers.onStatus?.(parsed.message);
        if (event === "meta") handlers.onMeta?.(parsed);
        if (event === "delta") handlers.onDelta(parsed.text);
        if (event === "done") handlers.onDone?.(parsed.assistantMessage);
        if (event === "error") throw new Error(parsed.message || "Không thể hoàn tất câu trả lời");
      }
      if (done) break;
    }
  },
  ceoChatConversations: () => request<ChatConversation[]>("/chat/ceo/conversations"),
  createCeoChatConversation: () => request<ChatConversation>("/chat/ceo/conversations", { method: "POST", body: JSON.stringify({}) }),
  ceoChatConversation: (id: string) => request<ChatConversation>(`/chat/ceo/conversations/${id}`),
  renameCeoChatConversation: (id: string, title: string) => request<ChatConversation>(`/chat/ceo/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteCeoChatConversation: (id: string) => request<{ success: boolean }>(`/chat/ceo/conversations/${id}`, { method: "DELETE" }),
  streamCeoChatMessage: async (conversationId: string, content: string, handlers: CeoChatStreamHandlers, signal?: AbortSignal, retryAssistantMessageId?: string) => {
    const response = await fetch(`${API_BASE}/chat/ceo/conversations/${conversationId}/messages/stream`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream", "Cache-Control": "no-cache" },
      body: JSON.stringify({ content, retryAssistantMessageId })
    });
    if (!response.ok || !response.body) {
      if (response.status === 401) window.dispatchEvent(new CustomEvent("feline:session-expired"));
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || `Yêu cầu thất bại (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === "status") handlers.onStatus?.(parsed.message);
        if (event === "meta") handlers.onMeta?.(parsed);
        if (event === "delta") handlers.onDelta(parsed.text);
        if (event === "done") handlers.onDone?.(parsed.assistantMessage);
        if (event === "error") throw new Error(parsed.message || "Không thể hoàn tất câu trả lời");
      }
      if (done) break;
    }
  },
  tiktokChatConversations: () => request<ChatConversation[]>("/chat/tiktok/conversations"),
  createTiktokChatConversation: () => request<ChatConversation>("/chat/tiktok/conversations", { method: "POST", body: JSON.stringify({}) }),
  tiktokChatConversation: (id: string) => request<ChatConversation>(`/chat/tiktok/conversations/${id}`),
  renameTiktokChatConversation: (id: string, title: string) => request<ChatConversation>(`/chat/tiktok/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteTiktokChatConversation: (id: string) => request<{ success: boolean }>(`/chat/tiktok/conversations/${id}`, { method: "DELETE" }),
  streamTiktokChatMessage: async (conversationId: string, content: string, handlers: CeoChatStreamHandlers, signal?: AbortSignal, retryAssistantMessageId?: string) => {
    const response = await fetch(`${API_BASE}/chat/tiktok/conversations/${conversationId}/messages/stream`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream", "Cache-Control": "no-cache" },
      body: JSON.stringify({ content, retryAssistantMessageId })
    });
    if (!response.ok || !response.body) {
      if (response.status === 401) window.dispatchEvent(new CustomEvent("feline:session-expired"));
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || `Yêu cầu thất bại (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === "status") handlers.onStatus?.(parsed.message);
        if (event === "meta") handlers.onMeta?.(parsed);
        if (event === "delta") handlers.onDelta(parsed.text);
        if (event === "done") handlers.onDone?.(parsed.assistantMessage);
        if (event === "error") throw new Error(parsed.message || "Không thể hoàn tất câu trả lời");
      }
      if (done) break;
    }
  },
  streamOfficeDelegation: async (
    question: string,
    reportDate: string | undefined,
    handlers: OfficeDelegationHandlers,
    signal?: AbortSignal
  ) => {
    const response = await fetch(`${API_BASE}/office/delegations/stream`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({ question, reportDate })
    });
    if (!response.ok || !response.body) {
      if (response.status === 401) window.dispatchEvent(new CustomEvent("feline:session-expired"));
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || `Yêu cầu thất bại (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === "stage") handlers.onStage?.(parsed.stage, parsed.message);
        if (event === "result") handlers.onResult?.(parsed);
        if (event === "done") handlers.onDone?.(parsed.runId);
        if (event === "error") throw new Error(parsed.message || "Không thể hoàn tất yêu cầu liên công ty");
      }
      if (done) break;
    }
  }
};
