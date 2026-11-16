import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export const ACCESS_PUBLIC = "access:public";
export const ACCESS_ROLES = "access:roles";
export const ACCESS_AGENT = "access:agent";

export const ACCESS_ACTIONS = [
  "view",
  "run",
  "export",
  "approve",
  "manage_members",
  "manage_agent",
  "manage_data_scope",
  "manage_sources",
  "view_audit",
  "view_cost",
  "manage_platform"
] as const;

export type AccessAction = typeof ACCESS_ACTIONS[number];

export interface AccessGrantView {
  id: string;
  agentId: string;
  capabilityIds: string[];
  dataScopeIds: string[];
  actions: AccessAction[];
  expiresAt: string | null;
}

export interface AccessProfile {
  platformAdmin: boolean;
  grants: AccessGrantView[];
}

export interface AgentAccessRequirement {
  agentId: string;
  action: AccessAction;
  dataScopeIds?: string[];
  capabilityId?: string;
  capabilityBodyField?: string;
}

export const Public = () => SetMetadata(ACCESS_PUBLIC, true);
export const RequireRoles = (...roles: UserRole[]) => SetMetadata(ACCESS_ROLES, roles);
export const RequireAgentAccess = (requirement: AgentAccessRequirement) =>
  SetMetadata(ACCESS_AGENT, requirement);

function includesOrWildcard(values: string[], expected: string): boolean {
  return values.includes("*") || values.includes(expected);
}

export function hasAgentAccess(
  profile: AccessProfile,
  requirement: AgentAccessRequirement,
  dynamicCapabilityId?: string
): boolean {
  if (profile.platformAdmin) return true;
  const capabilityId = requirement.capabilityId || dynamicCapabilityId;
  return profile.grants.some((grant) => {
    if (grant.agentId !== requirement.agentId) return false;
    if (!includesOrWildcard(grant.actions, requirement.action)) return false;
    if (capabilityId && !includesOrWildcard(grant.capabilityIds, capabilityId)) return false;
    return (requirement.dataScopeIds || []).every((scopeId) =>
      includesOrWildcard(grant.dataScopeIds, scopeId)
    );
  });
}
