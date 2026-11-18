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
  ,TiktokDashboardData, EtsyDashboardData
  ,WorkTask, WorkTaskPriority, WorkTaskStatus, WorkTaskSummary, WorkTaskUpdate, WorkTaskPerson, OrganizationDepartment, WorkTaskView, WorkTaskDateField
  ,TeamDailyReport, TeamDailyReportComment, TeamDailyReportTab
  ,NotificationList
} from "./types";
import { notifyError, notifySuccess } from "./notifications";

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

type RequestOptions = RequestInit & {
  successMessage?: string;
  silentSuccess?: boolean;
  silentError?: boolean;
};

function mutationMessage(method: string, path: string) {
  if (path === "/auth/login") return "Đăng nhập thành công.";
  if (path === "/auth/logout") return "Đã đăng xuất.";
  if (path === "/auth/change-password") return "Mật khẩu đã được cập nhật.";
  if (path.includes("/checklist")) return method === "DELETE" ? "Đã xóa mục checklist." : method === "POST" ? "Đã thêm mục checklist." : "Checklist đã được cập nhật.";
  if (path.endsWith("/updates")) return "Đã đăng cập nhật công việc.";
  if (path.startsWith("/tasks")) return method === "POST" ? "Đã tạo công việc." : "Công việc đã được cập nhật.";
  if (path.includes("/conversations")) return method === "DELETE" ? "Đã xóa cuộc trò chuyện." : method === "PATCH" ? "Đã đổi tên cuộc trò chuyện." : "Đã tạo cuộc trò chuyện mới.";
  if (path.startsWith("/admin/users")) return method === "POST" ? "Đã tạo tài khoản." : "Thông tin tài khoản đã được cập nhật.";
  if (path.includes("access-grants")) return method === "DELETE" ? "Đã thu hồi quyền truy cập." : "Quyền truy cập đã được cập nhật.";
  if (path.startsWith("/knowledge")) return method === "DELETE" ? "Đã xóa dữ liệu tri thức." : "Kho tri thức đã được cập nhật.";
  if (method === "DELETE") return "Đã xóa thành công.";
  if (method === "PATCH" || method === "PUT") return "Đã lưu thay đổi.";
  return "Thao tác đã hoàn tất.";
}

function notifiedError(message: string) {
  notifyError(message);
  return new Error(message);
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { successMessage, silentSuccess, silentError, ...init } = options || {};
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
    if (!silentError) notifyError(error.message);
    throw error;
  }
  const method = (init.method || "GET").toUpperCase();
  if (method !== "GET" && !silentSuccess) notifySuccess(successMessage || mutationMessage(method, path));
  if (method !== "GET" && (path.startsWith("/tasks") || path.startsWith("/daily-reports"))) {
    window.dispatchEvent(new CustomEvent("feline:notifications-refresh"));
  }
  return data as T;
}

async function multipartRequest<T>(path: string, form: FormData, successMessage = "Tệp đã được tải lên thành công."): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: form
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent("feline:session-expired"));
    throw notifiedError(data?.message || `Yêu cầu thất bại (${response.status})`);
  }
  notifySuccess(successMessage);
  return data as T;
}

export const api = {
  notifications: (limit = 30) => request<NotificationList>(`/notifications?limit=${limit}`, { silentError: true }),
  notificationUnreadCount: () => request<{ unread: number }>("/notifications/unread-count", { silentError: true }),
  readNotification: (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: "PATCH", silentSuccess: true, silentError: true }),
  readAllNotifications: () => request<{ success: boolean; updated: number }>("/notifications/read-all", { method: "PATCH", silentSuccess: true, silentError: true }),
  login: (email: string, password: string) => request<{ expiresAt: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }),
  me: () => request<AuthSession>("/auth/me", { silentError: true }),
  logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; reauthenticationRequired: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    }),
  adminUsers: () => request<ManagedUser[]>("/admin/users"),
  accessCatalog: () => request<AccessCatalog>("/admin/access-catalog"),
  createUser: (input: { email: string; displayName: string; departmentId?: string; teamId?: string; role: UserRole; password: string }) =>
    request<ManagedUser>("/admin/users", { method: "POST", body: JSON.stringify(input) }),
  updateUser: (id: string, input: { displayName?: string; departmentId?: string; teamId?: string; role?: UserRole; status?: string; password?: string }) =>
    request<ManagedUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  createGrant: (input: Omit<ManagedAccessGrant, "id" | "createdAt"> & { userId: string }) =>
    request<ManagedAccessGrant>("/admin/access-grants", { method: "POST", body: JSON.stringify(input) }),
  updateGrant: (id: string, input: Partial<Omit<ManagedAccessGrant, "id" | "createdAt">>) =>
    request<ManagedAccessGrant>(`/admin/access-grants/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  revokeGrant: (id: string) => request<{ success: boolean }>(`/admin/access-grants/${id}`, { method: "DELETE" }),
  syncTiktokTeam: (externalTeamId: number) => request<{ created: number; updated: number; skipped: number }>("/admin/organization/sync-tiktok-team", { method: "POST", body: JSON.stringify({ externalTeamId }) }),
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
  tasks: (filters: { status?: WorkTaskStatus; department?: string; team?: string; assignee?: string; search?: string; view?: WorkTaskView; dateField?: WorkTaskDateField; from?: string; to?: string } = {}) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    return request<WorkTask[]>(`/tasks${query.size ? `?${query}` : ""}`);
  },
  taskSummary: (department?: string) => request<WorkTaskSummary>(`/tasks/summary${department ? `?department=${encodeURIComponent(department)}` : ""}`),
  task: (id: string) => request<WorkTask>(`/tasks/${id}`),
  taskAssignees: (department = "TIKTOK", team?: string) => request<Array<WorkTaskPerson & { role: UserRole }>>(`/tasks/assignees?department=${encodeURIComponent(department)}${team ? `&team=${encodeURIComponent(team)}` : ""}`),
  taskDepartments: () => request<OrganizationDepartment[]>("/tasks/departments"),
  createTask: (input: { title: string; description: string; departmentCode: string; departmentName: string; teamId?: string; agentId?: string; priority: WorkTaskPriority; dueAt?: string; estimatedMinutes?: number; assigneeId?: string; checklist?: string[] }) =>
    request<WorkTask>("/tasks", { method: "POST", body: JSON.stringify(input) }),
  updateTask: (id: string, input: Partial<{ status: WorkTaskStatus; progressPercent: number; message: string; title: string; description: string; priority: WorkTaskPriority; dueAt: string | null; teamId: string; assigneeId: string; estimatedMinutes: number | null }>) =>
    request<WorkTask>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  claimTask: (id: string) => request<WorkTask>(`/tasks/${id}/claim`, { method: "POST", successMessage: "Bạn đã nhận phụ trách công việc." }),
  releaseTask: (id: string) => request<WorkTask>(`/tasks/${id}/release`, { method: "POST", successMessage: "Đã trả công việc về danh sách chờ tiếp nhận." }),
  reorderTasks: (status: WorkTaskStatus, taskIds: string[]) => request<{ success: boolean }>("/tasks/reorder", {
    method: "POST",
    body: JSON.stringify({ status, taskIds }),
    silentSuccess: true
  }),
  archiveTask: (id: string) => request<WorkTask>(`/tasks/${id}/archive`, { method: "POST", successMessage: "Đã đưa công việc vào lưu trữ." }),
  restoreTask: (id: string) => request<WorkTask>(`/tasks/${id}/restore`, { method: "POST", successMessage: "Đã khôi phục công việc." }),
  addTaskUpdate: (id: string, input: { message: string; progressPercent?: number }) =>
    request<WorkTaskUpdate>(`/tasks/${id}/updates`, { method: "POST", body: JSON.stringify(input) }),
  addTaskChecklistItem: (id: string, title: string) =>
    request<WorkTask>(`/tasks/${id}/checklist`, { method: "POST", body: JSON.stringify({ title }) }),
  updateTaskChecklistItem: (id: string, itemId: string, input: { isCompleted?: boolean; title?: string }) =>
    request<WorkTask>(`/tasks/${id}/checklist/${itemId}`, { method: "PATCH", body: JSON.stringify(input) }),
  removeTaskChecklistItem: (id: string, itemId: string) =>
    request<WorkTask>(`/tasks/${id}/checklist/${itemId}`, { method: "DELETE" }),
  dailyReportTeams: (date?: string) => request<TeamDailyReportTab[]>(`/daily-reports/teams${date ? `?date=${encodeURIComponent(date)}` : ""}`),
  teamDailyReports: (teamId: string, from?: string, to?: string) => {
    const query = new URLSearchParams({ teamId });
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<TeamDailyReport[]>(`/daily-reports?${query}`);
  },
  teamDailyReport: (id: string) => request<TeamDailyReport>(`/daily-reports/${id}`),
  createTeamDailyReport: (input: { teamId: string; reportDate: string; summary: string; completedWork: string; inProgressWork: string; blockers: string; nextPlan: string }) =>
    request<TeamDailyReport>("/daily-reports", { method: "POST", body: JSON.stringify(input), successMessage: "Đã tạo báo cáo hằng ngày." }),
  updateTeamDailyReport: (id: string, input: Partial<Pick<TeamDailyReport, "summary" | "completedWork" | "inProgressWork" | "blockers" | "nextPlan">>) =>
    request<TeamDailyReport>(`/daily-reports/${id}`, { method: "PATCH", body: JSON.stringify(input), successMessage: "Đã lưu nội dung báo cáo." }),
  submitTeamDailyReport: (id: string) => request<TeamDailyReport>(`/daily-reports/${id}/submit`, { method: "POST", successMessage: "Đã gửi báo cáo cho CEO." }),
  acknowledgeTeamDailyReport: (id: string) => request<TeamDailyReport>(`/daily-reports/${id}/acknowledge`, { method: "POST", successMessage: "Đã xác nhận báo cáo." }),
  commentTeamDailyReport: (id: string, message: string) => request<TeamDailyReportComment>(`/daily-reports/${id}/comments`, { method: "POST", body: JSON.stringify({ message }), successMessage: "Đã đăng bình luận." }),
  tiktokDashboard: (startDate: string, endDate: string) => request<TiktokDashboardData>(`/tiktok/dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`),
  etsyDashboard: (input: { startDate: string; endDate: string; sellerTeamId?: string; shopId?: string; sellerId?: string }) => {
    const query = new URLSearchParams({ startDate: input.startDate, endDate: input.endDate });
    if (input.sellerTeamId) query.set("sellerTeamId", input.sellerTeamId);
    if (input.shopId) query.set("shopId", input.shopId);
    if (input.sellerId) query.set("sellerId", input.sellerId);
    return request<EtsyDashboardData>(`/etsy/dashboard?${query}`);
  },
  sourceHealth: () => request<Record<string, unknown>>("/metrics/source/health"),
  dailyMetrics: (date: string) => request<DailyMetrics>(`/metrics/workshop/daily/${date}`),
  dailyReport: async (date: string): Promise<DailyReport | null> => {
    try {
      return await request<DailyReport>(`/reports/workshop/daily/${date}`, { silentError: true });
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
    if (!response.ok) throw notifiedError(data?.message || `Tải ảnh thất bại (${response.status})`);
    notifySuccess("Ảnh đã được tải lên.");
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
      throw notifiedError(data?.message || `Yêu cầu thất bại (${response.status})`);
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
        if (event === "error") throw notifiedError(parsed.message || "Không thể hoàn tất câu trả lời");
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
      throw notifiedError(data?.message || `Yêu cầu thất bại (${response.status})`);
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
        if (event === "error") throw notifiedError(parsed.message || "Không thể hoàn tất câu trả lời");
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
      throw notifiedError(data?.message || `Yêu cầu thất bại (${response.status})`);
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
        if (event === "error") throw notifiedError(parsed.message || "Không thể hoàn tất câu trả lời");
      }
      if (done) break;
    }
  },
  etsyChatConversations: () => request<ChatConversation[]>("/chat/etsy/conversations"),
  createEtsyChatConversation: () => request<ChatConversation>("/chat/etsy/conversations", { method: "POST", body: JSON.stringify({}) }),
  etsyChatConversation: (id: string) => request<ChatConversation>(`/chat/etsy/conversations/${id}`),
  renameEtsyChatConversation: (id: string, title: string) => request<ChatConversation>(`/chat/etsy/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteEtsyChatConversation: (id: string) => request<{ success: boolean }>(`/chat/etsy/conversations/${id}`, { method: "DELETE" }),
  streamEtsyChatMessage: async (conversationId: string, content: string, handlers: CeoChatStreamHandlers, signal?: AbortSignal, retryAssistantMessageId?: string) => {
    const response = await fetch(`${API_BASE}/chat/etsy/conversations/${conversationId}/messages/stream`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream", "Cache-Control": "no-cache" },
      body: JSON.stringify({ content, retryAssistantMessageId })
    });
    if (!response.ok || !response.body) {
      if (response.status === 401) window.dispatchEvent(new CustomEvent("feline:session-expired"));
      const data = await response.json().catch(() => null);
      throw notifiedError(data?.message || `Yêu cầu thất bại (${response.status})`);
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
        if (event === "error") throw notifiedError(parsed.message || "Không thể hoàn tất câu trả lời");
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
      throw notifiedError(data?.message || `Yêu cầu thất bại (${response.status})`);
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
        if (event === "error") throw notifiedError(parsed.message || "Không thể hoàn tất yêu cầu liên công ty");
      }
      if (done) break;
    }
  }
};
