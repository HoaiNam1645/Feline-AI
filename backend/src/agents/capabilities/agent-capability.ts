export interface AgentGenerationAudit {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
}

export interface AgentCapabilityResult<TOutput = unknown> {
  output: TOutput;
  metricSnapshotId?: string;
  generation?: AgentGenerationAudit;
}

export interface AgentExecutionContext {
  signal?: AbortSignal;
  onTextDelta?: (text: string) => void;
  actorUserId?: string;
  conversationId?: string;
  operationAuditId?: string;
  images?: Array<{
    id: string;
    name: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    data: string;
  }>;
}

export interface AgentCapability<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown
> {
  readonly id: string;
  readonly promptVersion: string;
  validateInput(input: unknown): TInput;
  execute(
    agentRunId: string,
    input: TInput,
    context?: AgentExecutionContext
  ): Promise<AgentCapabilityResult<TOutput>>;
}

export const LEMIEX_CAPABILITIES = Symbol("LEMIEX_CAPABILITIES");
