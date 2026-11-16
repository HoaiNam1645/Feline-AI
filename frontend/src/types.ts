export interface AgentDefinition {
  id: string;
  name: string;
  domain: string;
  mission: string;
  provider: {
    enabled: boolean;
    apiKeyConfigured: boolean;
    workspaceIdConfigured: boolean;
    model: string | null;
  };
  capabilities: Array<{ id: string; name: string; status: "available" | "planned"; riskLevel: string }>;
  registeredTools: Array<{ id: string; description: string }>;
}

export type UserRole = "ADMIN" | "MANAGER" | "USER";

export type AccessAction =
  | "view"
  | "run"
  | "export"
  | "approve"
  | "manage_members"
  | "manage_agent"
  | "manage_data_scope"
  | "manage_sources"
  | "view_audit"
  | "view_cost"
  | "manage_platform";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  departmentCode: string | null;
  role: UserRole;
  status: "ACTIVE" | "LOCKED" | "DISABLED";
}

export interface AccessGrant {
  id: string;
  agentId: string;
  capabilityIds: string[];
  dataScopeIds: string[];
  actions: AccessAction[];
  expiresAt: string | null;
}

export interface ManagedAccessGrant extends AccessGrant {
  createdAt: string;
}

export interface ManagedUser extends AuthUser {
  lastLoginAt: string | null;
  createdAt: string;
  grants: ManagedAccessGrant[];
}

export interface AccessCatalog {
  actions: AccessAction[];
  agents: Array<{
    id: string;
    name: string;
    domain: string;
    capabilities: Array<{
      id: string;
      name: string;
      description: string;
      status: "available" | "planned";
      riskLevel: string;
    }>;
    dataScopes: Array<{
      id: string;
      name: string;
      description: string | null;
    }>;
  }>;
}

export interface AuthSession {
  user: AuthUser;
  access: {
    platformAdmin: boolean;
    grants: AccessGrant[];
  };
}

export interface DailyMetrics {
  meta: { reportDate: string; generatedAtUtc: string; specVersion: string };
  intake: {
    orders: number;
    items: number;
    quantity: number;
    methods?: Array<{ method: string; items: number; quantity: number }>;
    orderTypes?: Array<{ orderType: string; orders: number }>;
    priorities?: Array<{ priority: string; orders: number }>;
    comparison: { previousDayChangePercent: number | null; previousWeekChangePercent: number | null };
  };
  shipout: { completedOrders: number; completedItems: number };
  backlog: {
    totalOrders: number;
    byAgeBand: Array<{ ageBand: string; orders: number }>;
    byStatus: Array<{ status: string; orders: number; atLeast72Hours: number; averageAgeHours: number }>;
  };
  remakes: { cases: number; quantity: number };
  management?: {
    financials: {
      totalCost: number;
      paidCost: number;
      printCost: number;
      extraFee: number;
      refundFee: number;
      embroideryFee: number;
      noDesignFee: number;
      priorityFee: number;
      shippingCost: number;
    };
    dailyTrend: Array<{ reportDate: string; orders: number; revenue: number; fees: number }>;
    sellerRanking: Array<{ sellerId: number; seller: string; stores: string; orders: number; items: number; quantity: number; revenue: number; fees: number }>;
  };
  dataQuality: Record<string, number>;
}

export interface LemiexReview {
  summary: string;
  dataShows: string[];
  needsInvestigation: string[];
  operationalPriorities: Array<{ priority: "high" | "medium" | "low"; action: string; evidence: string }>;
  limitations: string[];
}

export interface AgentToolCall {
  id: string;
  toolId: string;
  status: string;
  output?: { metrics?: DailyMetrics; content?: string; templateVersion?: string };
}

export interface AgentRun {
  id: string;
  capabilityId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED";
  input: { reportDate?: string };
  output: LemiexReview | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  toolCalls: AgentToolCall[];
}

export interface DailyReport {
  reportDate: string;
  status: string;
  templateVersion: string;
  characterCount: number;
  content: string;
}

export interface TiktokDashboardData {
  range: { startDate: string; endDate: string; timeZone: string };
  teams: Array<{
    id: number; name: string; code: string | null; orders: number; fulfilledOrders: number; items: number;
    estimatedRevenue: number; fulfillmentCost: number; refundAmount: number; adsSpend: number; contribution: number;
    sellerCount: number; stores: { total: number; healthy: number; attention: number };
    statuses: { fulfilled: number; pending: number; onHold: number; cancelled: number };
  }>;
  sellers: Array<{
    teamId: number; teamName: string; teamCode: string | null; sellerId: number; sellerName: string;
    orders: number; fulfilledOrders: number; items: number; stores: number; estimatedRevenue: number;
    fulfillmentCost: number; refundAmount: number; adsSpend: number; contribution: number;
  }>;
  trend: Array<{ reportDate: string; teamId: number; teamName: string; orders: number; estimatedRevenue: number }>;
  source: { access: "read-only"; generatedAtUtc: string; dataUpdatedAtUtc: string | null };
}

export type OfficeDelegationStage =
  | "AUTHORIZED"
  | "DISPATCHED"
  | "PROCESSING"
  | "RESULT_READY"
  | "COMPLETED";

export interface OfficeDelegationResult {
  runId: string;
  question: string;
  route: {
    fromAgentId: "ceo-ai";
    toAgentId: "lemiex-ai";
    capabilityId: string;
  };
  reportDate: string;
  answerMarkdown: string;
  metric: {
    id: "orders";
    label: string;
    value: number;
    unit: string;
    previousDayChangePercent: number | null;
  };
  source: {
    id: "shop-test";
    access: "read-only";
    generatedAtUtc: string;
    dataUpdatedAtUtc: string;
    timeZone: string;
  };
}

export interface ChatSource {
  label: string;
  reportDate: string;
  generatedAtUtc: string;
  dataUpdatedAtUtc: string;
  documentId?: string;
  title?: string;
  category?: string;
  ownerName?: string;
  ownerDepartmentName?: string;
  versionNumber?: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  chunkId?: string;
  chunkIndex?: number;
  score?: number;
}

export interface ChatAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  contentUrl: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT";
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELED";
  content: string;
  reportDate: string | null;
  agentRunId: string | null;
  sources: ChatSource[] | null;
  suggestions: string[] | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: ChatAttachment[];
  usage?: {
    model: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    estimatedCostUsd: number | null;
    responseTimeMs: number | null;
  } | null;
}

export type ChatAnswerability = "ANSWERED" | "UNANSWERED";

export interface ChatQuestionEvaluation {
  id: string;
  userId: string | null;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  agentRunId: string | null;
  agentId: string;
  question: string;
  answer: string;
  classification: ChatAnswerability;
  reasonCode: string;
  reason: string | null;
  source: "SYSTEM" | "ADMIN";
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: Pick<AuthUser, "id" | "displayName" | "email" | "role"> | null;
}

export interface ChatQuestionEvaluationList {
  items: ChatQuestionEvaluation[];
  total: number;
  page: number;
  limit: number;
  summary: { answered: number; unanswered: number };
  users: Array<Pick<AuthUser, "id" | "displayName" | "email" | "role">>;
}

export interface ChatConversation {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
  _count?: { messages: number };
}

export type KnowledgeDocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type KnowledgeVersionStatus = "PROCESSING" | "READY" | "FAILED";

export interface KnowledgeAccessRule {
  id: string;
  departmentCode: string;
  departmentName: string;
  canRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  chunkIndex: number;
  content: string;
  tokenEstimate: number;
  embeddingModel: string;
  createdAt: string;
}

export interface KnowledgeVersion {
  id: string;
  versionNumber: number;
  status: KnowledgeVersionStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sourceType: string;
  sourceUrl?: string | null;
  originalFileName: string | null;
  mimeType?: string | null;
  characterCount?: number;
  chunkCount: number;
  embeddingModel: string | null;
  error?: string | null;
  indexedAt: string | null;
  createdAt: string;
  chunks?: KnowledgeChunk[];
}

export interface KnowledgeDocument {
  id: string;
  agentId: string;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  ownerDepartmentCode: string;
  ownerDepartmentName: string;
  ownerName: string;
  status: KnowledgeDocumentStatus;
  currentVersionNumber: number;
  isMock: boolean;
  createdAt: string;
  updatedAt: string;
  accessRules: KnowledgeAccessRule[];
  versions: KnowledgeVersion[];
}

export interface KnowledgeList {
  items: KnowledgeDocument[];
  summary: {
    total: number;
    published: number;
    mock: number;
    chunks: number;
    embeddingModel: string;
  };
}

export interface KnowledgeSearchResult {
  score: number;
  chunkId: string;
  chunkIndex: number;
  content: string;
  document: {
    id: string;
    title: string;
    category: string;
    ownerName: string;
    ownerDepartmentName: string;
    versionNumber: number;
    effectiveFrom: string | null;
    effectiveTo: string | null;
  };
}
