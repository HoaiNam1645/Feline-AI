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
  departmentId: string | null;
  teamId: string | null;
  passwordResetRequired: boolean;
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
  department: OrganizationDepartment | null;
  team: OrganizationTeam | null;
  employeeCode: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  grants: ManagedAccessGrant[];
}

export interface OrganizationTeam {
  id: string;
  code: string;
  name: string;
  departmentId?: string;
  externalSource?: string | null;
  externalId?: string | null;
}

export interface OrganizationDepartment {
  id: string;
  code: string;
  name: string;
  agentId: string | null;
  teams?: OrganizationTeam[];
}

export interface AccessCatalog {
  actions: AccessAction[];
  organization: OrganizationDepartment[];
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

export type NotificationCategory = "TASK" | "REPORT";

export interface AppInboxNotification {
  id: string;
  category: NotificationCategory;
  eventType: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  route: string;
  metadata?: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  actor: Pick<AuthUser, "id" | "displayName" | "role"> | null;
}

export interface NotificationList {
  items: AppInboxNotification[];
  unread: number;
}

export type WorkTaskStatus = "DRAFT" | "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "BLOCKED" | "IN_REVIEW" | "COMPLETED" | "REJECTED" | "CANCELED";
export type WorkTaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type WorkTaskView = "ACTIVE" | "TODAY" | "OVERDUE" | "OVER_ESTIMATE" | "COMPLETED" | "ARCHIVED" | "ALL";
export type WorkTaskDateField = "createdAt" | "dueAt" | "startedAt" | "completedAt" | "updatedAt";

export interface WorkTaskPerson {
  id: string;
  displayName: string;
  email?: string;
  departmentCode?: string | null;
  teamId?: string | null;
  team?: OrganizationTeam | null;
}

export interface WorkTaskUpdate {
  id: string;
  type: string;
  message: string | null;
  fromStatus: WorkTaskStatus | null;
  toStatus: WorkTaskStatus | null;
  progressPercent: number | null;
  createdAt: string;
  actor: WorkTaskPerson;
}

export interface WorkTaskChecklistItem {
  id: string;
  title?: string;
  position?: number;
  isCompleted: boolean;
  completedAt?: string | null;
  completedBy?: Pick<WorkTaskPerson, "id" | "displayName"> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkTaskTimeEntry {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  actor: Pick<WorkTaskPerson, "id" | "displayName">;
}

export interface WorkTask {
  id: string;
  code: string;
  title: string;
  description: string;
  departmentCode: string;
  departmentName: string;
  teamId: string | null;
  team: OrganizationTeam | null;
  agentId: string | null;
  priority: WorkTaskPriority;
  status: WorkTaskStatus;
  position: number;
  progressPercent: number;
  dueAt: string | null;
  estimatedMinutes: number | null;
  startedAt: string | null;
  activeTimeSeconds: number;
  activeTimerStartedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  completionNote: string | null;
  archivedAt: string | null;
  archivedById: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: WorkTaskPerson;
  assignee: WorkTaskPerson | null;
  checklistItems: WorkTaskChecklistItem[];
  updates?: WorkTaskUpdate[];
  timeEntries?: WorkTaskTimeEntry[];
}

export interface WorkTaskSummary {
  total: number;
  active: number;
  today: number;
  review: number;
  completed: number;
  completedToday: number;
  overdue: number;
  overEstimate: number;
  archived: number;
  byStatus: Partial<Record<WorkTaskStatus, number>>;
}

export type TeamDailyReportStatus = "DRAFT" | "SUBMITTED" | "ACKNOWLEDGED";

export interface TeamReportPerson {
  id: string;
  displayName: string;
  role: UserRole;
  teamId?: string | null;
}

export interface TeamDailyReportComment {
  id: string;
  reportId: string;
  actorUserId: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  actor: TeamReportPerson;
}

export interface TeamDailyReport {
  id: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  teamId: string;
  team: OrganizationTeam;
  reportDate: string;
  status: TeamDailyReportStatus;
  summary: string;
  completedWork: string;
  inProgressWork: string;
  blockers: string;
  nextPlan: string;
  createdById: string;
  createdBy: TeamReportPerson;
  submittedBy: TeamReportPerson | null;
  submittedAt: string | null;
  acknowledgedBy: TeamReportPerson | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments: TeamDailyReportComment[];
}

export interface TeamDailyReportTab extends OrganizationTeam {
  department: { code: string; name: string };
  report: Pick<TeamDailyReport, "id" | "status" | "submittedAt" | "acknowledgedAt"> | null;
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

export interface EtsyDashboardData {
  report: { startDate: string; endDate: string; timeZone: string; currency: string; generatedAt: string };
  source: { dataUpdatedAt: string | null; shopSyncedAt: string | null };
  filters: {
    sellerTeams: Array<{ id: string; name: string }>;
    shops: Array<{ id: string; name: string }>;
    sellers: Array<{ id: string; name: string; email: string; teamId: string | null }>;
  };
  summary: { orders: number; items: number; grossBookedValue: number; recognizedRevenue: number; etsyNet: number; fulfillmentCost: number; designCost: number; refundAmount: number; manualCost: number; manualCostVnd: number; operationalProfit: number; funds: number; fundsVnd: number; shops: number; activeSellers: number };
  statuses: Array<{ status: string; orders: number }>;
  trend: Array<{ date: string; orders: number; items: number; net: number; profit: number }>;
  sellerTeams: Array<{ id: string; name: string; members: number; orders: number; items: number; grossBookedValue: number; net: number; profit: number }>;
  shops: Array<{ id: string; name: string; orders: number; items: number; net: number; profit: number; funds: number; fundsVnd: number }>;
  sellers: Array<{ id: string; name: string; email: string; teamId: string | null; teamName: string; orders: number; items: number; grossBookedValue: number; net: number; fulfillmentCost: number; designCost: number; refundAmount: number; profit: number }>;
  topProducts: Array<{ name: string; shopId: string; shopName: string; quantity: number; grossBookedValue: number; net: number }>;
  quality: { totalOrders: number; noSkuOrders: number; unknownSellerOrders: number; fallbackNetOrders: number; orderNetOrders: number; actualNetOrders: number; missingShopOrders: number; unattributedOrders: number; attributionRate: number; unknownPrefixes: Array<{ prefix: string; orders: number }> };
}

export interface AccountingDashboardData {
  report: { startDate: string; endDate: string; timeZone: string; currency: string; generatedAt: string };
  source: { id: string; access: "read-only"; dataUpdatedAt: string };
  summary: {
    income: number;
    expense: number;
    netCashFlow: number;
    transactions: number;
    activeAccounts: number;
    openReceivables: number;
    outstandingReceivables: number;
  };
  trend: Array<{ date: string; income: number; expense: number }>;
  categories: Array<{ id: string; name: string; income: number; expense: number }>;
  purchaseStatuses: Array<{ status: string; count: number; amount: number }>;
  conversionStatuses: Array<{ status: string; count: number; amountUsd: number; amountVnd: number }>;
  recentPurchases: Array<{
    id: string;
    title: string;
    kind: string;
    expectedAmount: number;
    currencyCode: string;
    status: string;
    createdAt: string;
    requester: { fullName: string };
    category: { name: string };
  }>;
  receivables: Array<{
    id: string;
    title: string;
    partyName: string;
    status: string;
    dueDate: string | null;
    amountVnd: number;
    paidVnd: number;
    outstandingVnd: number;
  }>;
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

export type MultiAgentId = "ceo-ai" | "tiktok-ai" | "etsy-ai" | "lemiex-ai";

export interface MultiAgentParticipantResult {
  agentId: MultiAgentId;
  agentName: string;
  capabilityId: string;
  status: "COMPLETED" | "FAILED" | "SKIPPED";
  markdown: string;
  sources: ChatSource[];
  runId: string | null;
  error: string | null;
  usage: {
    model: string | null;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number | null;
  } | null;
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
