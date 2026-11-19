import { AccessProfile } from "../auth/access-control";
import { UserRole } from "@prisma/client";

export type MultiAgentId = "ceo-ai" | "tiktok-ai" | "etsy-ai" | "lemiex-ai";

export interface MultiAgentActor {
  id: string;
  role: UserRole;
  departmentCode: string | null;
  access: AccessProfile;
}

export interface MultiAgentSource {
  label: string;
  reportDate?: string;
  generatedAtUtc?: string;
  dataUpdatedAtUtc?: string;
  timeZone?: string;
  access?: string;
}

export interface MultiAgentParticipantResult {
  agentId: MultiAgentId;
  agentName: string;
  capabilityId: string;
  status: "COMPLETED" | "FAILED" | "SKIPPED";
  markdown: string;
  sources: MultiAgentSource[];
  runId: string | null;
  error: string | null;
  usage: {
    model: string | null;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number | null;
  } | null;
}

export type MultiAgentEvent =
  | { type: "meeting_started"; meetingId: string; participants: MultiAgentId[] }
  | { type: "agent_started"; agentId: MultiAgentId; agentName: string }
  | { type: "agent_completed"; result: MultiAgentParticipantResult }
  | { type: "agent_failed"; result: MultiAgentParticipantResult }
  | { type: "synthesis_started"; message: string }
  | { type: "delta"; text: string }
  | { type: "complete"; assistantMessage: unknown; participants: MultiAgentParticipantResult[]; runId: string };
